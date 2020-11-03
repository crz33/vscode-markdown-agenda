import * as vscode from "vscode";
import * as moment from "moment";
import { Context } from "./context";
import { grepTodo, TodoItem } from "./todo";

const AGENDA_PREFIX = "markdown-agenda";

const MSG_WELCOME = [
  "Press key for an agenda command:", //
  "--------------------------------", //
  "a   Agenda for current week", //
  "t   List of all TODO entries", //
];

const FORMAT_DATE = "YYYY/MM/DD (ddd)";

const COMMANDS = [
  { key: `r`, id: `${AGENDA_PREFIX}.refreshTodoList` }, // Refresh TodoList

  { key: `a`, id: `${AGENDA_PREFIX}.showAgenda` }, // Show Agenda
  { key: `f`, id: `${AGENDA_PREFIX}.nextPage` }, // Next Page
  { key: `b`, id: `${AGENDA_PREFIX}.previousPage` }, // Previous Page

  { key: `v`, id: `${AGENDA_PREFIX}.selectRangePrefix` }, // Select Range
  { key: `w`, id: `${AGENDA_PREFIX}.selectRangeWeek` }, // Change Range Week
  { key: `m`, id: `${AGENDA_PREFIX}.selectRangeMonth` }, // Change Range Month
  { key: `y`, id: `${AGENDA_PREFIX}.selectRangeYear` }, // Change Range Year

  { key: `.`, id: `${AGENDA_PREFIX}.gotoToday` }, // Go To Today
];

type ResultOfCommand = "changed" | "unchanged";

type TypeOfRange = "W" | "F" | "M" | "Y";

export class AgendaDataProvider implements vscode.TextDocumentContentProvider {
  // emitter and its event
  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  private viewUri: vscode.Uri | undefined;

  private agendaView: AgendaView;
  private currentView: View | undefined;
  private todoList: TodoItem[] = [];

  constructor(private appContext: Context) {
    this.viewUri = undefined;
    this.agendaView = new AgendaView(this.appContext);
    this.currentView = undefined;
    this.bindCommands();
  }

  private bindCommands() {
    COMMANDS.forEach((command) => {
      this.appContext.vscodeContext.subscriptions.push(
        vscode.commands.registerCommand(command.key, () => {
          this.handleCommand(command.id); // bind key to command
        })
      );
      this.appContext.vscodeContext.subscriptions.push(
        vscode.commands.registerCommand(command.id, () => {
          this.handleCommand(command.id); // bind id to command
        })
      );
    });
  }

  private handleCommand(id: string) {
    this.appContext.debug(`"${id}" is handled.`);
    if (!this.currentView) {
      if (cmdEq(id, "showAgenda")) {
        this.currentView = this.agendaView; // switch agenda view
        this.refresh();
      }
    } else {
      // agenda or todo showed
      if (cmdEq(id, "refreshTodoList")) {
        grepTodo(this.appContext).then((todoList) => {
          this.todoList = todoList;
          this.refresh();
        });
      } else if ("changed" === this.currentView.receiveCommand(id)) {
        this.refresh();
      }
    }
  }

  private refresh() {
    jump2line(0);
    this.onDidChangeEmitter.fire(this.viewUri as vscode.Uri);
  }

  provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
    this.viewUri = uri;
    if (!this.currentView) {
      return MSG_WELCOME.join("\n");
    } else {
      return this.currentView.makeView(this.todoList);
    }
  }
}

class AgendaView implements View {
  private startDate: moment.Moment;
  private rangeType: TypeOfRange;
  private waitNextCommand: boolean;

  constructor(private appContext: Context) {
    moment.locale("ja");
    this.startDate = moment();
    this.rangeType = "W";
    this.waitNextCommand = false;
    this.init(this.rangeType);
  }

  // initialize agenda page variables
  init(rangeType: TypeOfRange): ResultOfCommand {
    let changed = false;

    // type of range
    if (this.rangeType !== rangeType) {
      changed = true;
      this.rangeType = rangeType;
    }

    // start date of agenda
    const newStateDate = moment();
    newStateDate.hour(0).minute(0).second(0).millisecond(0);
    if (rangeType === "W" || rangeType === "F") {
      newStateDate.day(this.appContext.getConf("agenda.startOfWeek"));
    } else if (rangeType === "M") {
      newStateDate.date(1);
    } else if (rangeType === "Y") {
      newStateDate.date(1).month(0);
    } else {
      newStateDate.day(this.appContext.getConf("agenda.startOfWeek"));
    }
    if (newStateDate.diff(this.startDate, "days") !== 0) {
      changed = true;
      this.startDate = newStateDate;
    }

    // return if page is changed
    if (changed) {
      return "changed";
    } else {
      return "unchanged";
    }
  }

  receiveCommand(id: string): ResultOfCommand {
    this.appContext.debug(`"${id}" is received.`);

    if (this.waitNextCommand) {
      this.waitNextCommand = false;

      if (cmdEq(id, "selectRangeWeek")) {
        return this.init("W");
      } else if (cmdEq(id, "selectRangeMonth")) {
        return this.init("M");
      } else if (cmdEq(id, "selectRangeYear")) {
        return this.init("Y");
      } else {
        // TODO warn : not supported keys
        return "unchanged";
      }
    }

    if (cmdEq(id, "nextPage")) {
      return this.movePage(1);
    } else if (cmdEq(id, "previousPage")) {
      return this.movePage(-1);
    } else if (cmdEq(id, "gotoToday")) {
      const result = this.init(this.rangeType);
      if (result === "unchanged") {
        // TODO fixme : move!!
        this.appContext.debug("FIXME move today");
      }
      return result;
    } else if (cmdEq(id, "selectRangePrefix")) {
      this.waitNextCommand = true;
      return "unchanged";
    }

    // TODO warn : not supported key
    return "unchanged";
  }

  movePage(direction: number): ResultOfCommand {
    if (this.rangeType === "W") {
      this.startDate.add(direction * 7, "days");
    } else if (this.rangeType === "F") {
      this.startDate.add(direction * 14, "days");
    } else if (this.rangeType === "M") {
      this.startDate.add(direction * 1, "M");
    } else if (this.rangeType === "Y") {
      this.startDate.add(direction * 1, "y");
    } else {
      this.startDate.add(direction * 7, "days");
    }
    return "changed";
  }

  makeView(todoList: TodoItem[]) {
    const agendaDate = this.startDate.clone();

    // count of date
    let agendaSize = 0;
    if (this.rangeType === "W") {
      agendaSize = 7;
    } else if (this.rangeType === "F") {
      agendaSize = 14;
    } else if (this.rangeType === "M") {
      agendaSize = agendaDate.clone().add(1, "M").diff(agendaDate, "days");
    } else if (this.rangeType === "Y") {
      agendaSize = agendaDate.clone().add(1, "y").diff(agendaDate, "days");
    } else {
      agendaSize = 7;
    }

    const lines: string[] = [];
    for (let i = 0; i < agendaSize; i++) {
      lines.push(agendaDate.format("YYYY/MM/DD (ddd)"));
      const filterdTodo = todoList.filter((todoItem) => {
        if (todoItem.scheduled) {
          const hours = todoItem.scheduled.diff(agendaDate, "minutes");
          return 0 <= hours && hours < 24 * 60;
        }
      });
      filterdTodo.forEach((todoItem) => {
        const title = todoItem.title;
        const priority = todoItem.priority === "" ? "" : `#${todoItem.priority}`;
        const tags = todoItem.tags.join(",");
        lines.push(`   ${title} ${priority} ${tags}`);
      });
      agendaDate.add(1, "days");
    }
    return lines.join("\n");
  }
}

abstract class View {
  abstract receiveCommand(id: string): ResultOfCommand;
  abstract makeView(todoList: TodoItem[]): string;
}

const cmdEq = (id: string, name: string): boolean => {
  return id === `${AGENDA_PREFIX}.${name}`;
};

const jump2line = (line: number) => {
  const editor = vscode.window.activeTextEditor;
  const charactor = 0;
  if (editor && editor.document.uri.scheme === `${AGENDA_PREFIX}`) {
    editor.selection = new vscode.Selection(new vscode.Position(line, charactor), new vscode.Position(line, charactor));
    editor.revealRange(new vscode.Range(line, charactor, line, charactor), vscode.TextEditorRevealType.Default);
  }
};
