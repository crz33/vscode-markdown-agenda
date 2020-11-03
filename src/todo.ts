import * as vscode from "vscode";
import * as child_process from "child_process";
import { rgPath } from "vscode-ripgrep";
import { Context } from "./context";
import * as moment from "moment";

export const grepTodo = (appContext: Context): Promise<TodoItem[]> => {
  // Refresh
  appContext.debug("Refresh Todo List");

  return new Promise((resolve, reject) => {
    // Make list of folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const folders = workspaceFolders?.filter((value) => value.uri.scheme === "file");
    if (!folders) {
      return resolve([]);
    }

    // Grep folders, Get STDOUT
    const parser = new Parser();
    const todoList: TodoItem[] = [];
    const greps = folders.map((folder) => {
      return grep(appContext, folder.uri.path);
    });
    Promise.all(greps).then((grepResults) => {
      // After grep
      grepResults.forEach((stdout) => {
        stdout = stdout.trim();
        if (stdout === "") {
          return;
        }
        stdout.split("\n").forEach((line) => {
          todoList.push(new TodoItem(line, parser));
        });
      });
      todoList.forEach((todoItem) => {
        appContext.debug(`found : ${todoItem.toString()}`);
      });
      return resolve(todoList);
    });
  });
};

const grep = (appContext: Context, folderPath: string): Promise<string> => {
  // create cmdline
  let cmdline = `${rgPath} --no-messages --vimgrep -H --column --line-number --color never --max-columns=1000 --no-config`;
  cmdline = `${cmdline} -e "^#+\\s+(TODO)\\s"`;
  cmdline = `${cmdline} ${folderPath}`;

  return new Promise((resolv, reject) => {
    let result = "";
    appContext.debug(`cmd : ${cmdline} `);
    const childProcess = child_process.exec(cmdline, {
      maxBuffer: 200 * 1024,
      cwd: "/",
    });
    childProcess.stdout?.on("data", (data) => {
      result += data;
    });
    childProcess.stderr?.on("data", (data) => {
      appContext.debug(`grep error: ${data}`);
      reject(data);
    });
    childProcess.on("close", (code, signal) => {
      appContext.debug(`grep result: ${code}:${signal}\n${result}`);
      resolv(result);
    });
  });
};

export class TodoItem {
  // result of ripgrep
  public file: string;
  public lineNo: number;
  public columnNo: number;
  public todoLine: string;
  // parsed todo line
  public title: string;
  public state: string;
  public scheduled: moment.Moment | undefined;
  public scheduledEnd: moment.Moment | undefined;
  public deadlined: moment.Moment | undefined;
  public priority: string;
  public tags: string[];

  constructor(line: string, parser: Parser) {
    // Parse ripgrep result, to file, lineno, columnno, text
    const matchOfRipgrep = parser.parseRipgrepResult(line);
    if (matchOfRipgrep && matchOfRipgrep.groups) {
      // Normal
      this.file = matchOfRipgrep.groups.file;
      this.lineNo = Number(matchOfRipgrep.groups.line);
      this.columnNo = Number(matchOfRipgrep.groups.column);
      this.todoLine = matchOfRipgrep.groups.text;
    } else {
      // for Windows ( c:\xxx ) ?
      let file = "";
      if (line.length > 1 && line[1] === ":") {
        file = line.substr(0, 2);
        file = file.substr(2);
      }
      const junkLine = line.split(":");
      this.file = junkLine.shift() as string;
      this.lineNo = Number(junkLine.shift() as string);
      this.columnNo = Number(junkLine.shift() as string);
      this.todoLine = junkLine.join(":");
    }

    // Parse greped TODO Line
    const matchOfTodoLine = parser.parseTodoLine(this.todoLine);
    if (matchOfTodoLine && matchOfTodoLine.groups) {
      this.state = matchOfTodoLine.groups.state;
      this.title = matchOfTodoLine.groups.title;
      const tagsGroup = matchOfTodoLine.groups.tags;
      // TODO タグの処理
      const tagData = parser.parseTags(tagsGroup.split(" @"));
      this.scheduled = tagData.scheduled;
      this.scheduledEnd = tagData.scheduledEnd;
      this.deadlined = tagData.deadlined;
      this.priority = tagData.priority;
      this.tags = tagData.normalTags;
    } else {
      this.title = line;
      this.state = "TODO";
      this.scheduled = undefined;
      this.scheduledEnd = undefined;
      this.priority = "";
      this.tags = [];
    }
  }

  toString() {
    return `[${this.file}:${this.lineNo}] ${this.title} (ss=${this.scheduled}, se=${this.scheduledEnd}, d=${this.deadlined}, p=${this.priority}, tags=${this.tags}`;
  }
}

interface TagData {
  scheduled: moment.Moment | undefined;
  scheduledEnd: moment.Moment | undefined;
  deadlined: moment.Moment | undefined;
  priority: string;
  normalTags: string[];
}

class Parser {
  private readonly regexOfRipgrep = RegExp(/^(?<file>.*):(?<line>\d+):(?<column>\d+):(?<text>.*)/);
  private readonly regexOfTodoLine = RegExp(
    /^#\s+(?<state>TODO|DONE)\s+(?<title>.+?)(?<tags>(\s+\@[\w\-#]+(\(.*\))*)*)\s*$/
  );
  private readonly scheduledTags = ["scheduled", "s"];
  private readonly deadlinedTags = ["deadlined", "d"];
  private readonly priorityTags = ["priority", "p"];
  private readonly dateFormat = "YYYY-MM-DD";

  private dateParser(tag: string): [moment.Moment | undefined, moment.Moment | undefined] {
    if (tag.indexOf("(") === -1 || tag.indexOf(")") === -1) {
      // has no date
      return [undefined, undefined];
    }
    let date = tag.substring(tag.indexOf("(") + 1, tag.length - 1);
    let times: string;
    [date, times] = date.split(" ");
    if (!times) {
      // only date
      return [moment(date, this.dateFormat), undefined];
    } else {
      const scheduled = moment(date, this.dateFormat);
      // has hours
      let start, end;
      [start, end] = times.split("-");
      // start
      let hour, minute;
      [hour, minute] = start.split(":");
      scheduled.hour(Number(hour));
      scheduled.minute(minute ? Number(minute) : 0);
      if (!end) {
        return [scheduled, undefined];
      } else {
        // only start hour
        const scheduledEnd = moment(scheduled);
        [hour, minute] = end.split(":");
        scheduledEnd.set("hour", Number(hour));
        scheduledEnd.minute(minute ? Number(minute) : 0);
        return [scheduled, scheduledEnd];
      }
    }
  }

  parseRipgrepResult(line: string): RegExpExecArray | null {
    return this.regexOfRipgrep.exec(line);
  }

  parseTodoLine(todoLine: string): RegExpExecArray | null {
    return this.regexOfTodoLine.exec(todoLine);
  }

  parseTags(tags: string[]): TagData {
    const tagData: TagData = {
      scheduled: undefined,
      scheduledEnd: undefined,
      deadlined: undefined,
      priority: "",
      normalTags: [],
    };
    tags.forEach((tag) => {
      tag = tag.trim();
      if (tag === "") {
        return;
      }
      for (const definedTag of this.scheduledTags) {
        if (tag.startsWith(`${definedTag}(`)) {
          [tagData.scheduled, tagData.scheduledEnd] = this.dateParser(tag);
          return;
        }
      }
      for (const definedTag of this.deadlinedTags) {
        if (tag.startsWith(`${definedTag}(`)) {
          [tagData.deadlined] = this.dateParser(tag);
          return;
        }
      }
      for (const definedTag of this.priorityTags) {
        if (tag.startsWith(`${definedTag}`)) {
          tagData.priority = tag.substring(tag.indexOf("(") + 1, tag.length - 1);
          return;
        }
      }
      tagData.normalTags.push(`@${tag}`);
    });
    return tagData;
  }
}
