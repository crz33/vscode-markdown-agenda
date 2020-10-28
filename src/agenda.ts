import * as vscode from "vscode";
import * as moment from "moment";

const AGENDA_PREFIX = "markdown.agenda";

const MSG_WELCOME = [
  "Press key for an agenda command:", //
  "--------------------------------", //
  "a   Agenda for current week", //
  "t   List of all TODO entries", //
];

const FORMAT_DATE = "YYYY/MM/DD (ddd)";

const COMMANDS = [
  { key: `a`, id: `${AGENDA_PREFIX}.showAgenda` }, // Show Agenda
];

type ResultOfCommand = "done" | "ignore" | "store";

export class AgendaDataProvider implements vscode.TextDocumentContentProvider {
  // emitter and its event
  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  private viewUri: vscode.Uri | undefined;

  private agendaView: AgendaView;
  private currentView: View | undefined;

  constructor() {
    this.viewUri = undefined;
    this.agendaView = new AgendaView();
    this.currentView = undefined;
  }

  bindCommands(context: vscode.ExtensionContext) {
    COMMANDS.forEach((command) => {
      context.subscriptions.push(
        vscode.commands.registerCommand(command.key, () => {
          this.handleCommand(command.id); // bind key to command
        })
      );
      context.subscriptions.push(
        vscode.commands.registerCommand(command.id, () => {
          this.handleCommand(command.id); // bind id to command
        })
      );
    });
  }

  handleCommand(id: string) {
    console.log(`command : ${id}`);
    if (!this.currentView) {
      if (this.cmdEq(id, "showAgenda")) {
        this.currentView = this.agendaView; // switch agenda view
        this.reflesh();
        console.log("show agenda, reflesh.");
      }
    } else {
      // agenda or todo showed
    }
  }

  reflesh() {
    this.onDidChangeEmitter.fire(this.viewUri as vscode.Uri);
  }

  provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
    this.viewUri = uri;
    if (!this.currentView) {
      return MSG_WELCOME.join("\n");
    } else {
      return this.currentView.makeView();
    }
  }

  cmdEq(id: string, name: string): boolean {
    return id === `${AGENDA_PREFIX}.${name}`;
  }
}

class AgendaView implements View {
  private now: moment.Moment;

  constructor() {
    moment.locale("ja");
    this.now = moment();
  }

  receiveCommand(): ResultOfCommand {
    throw new Error("Method not implemented.");
  }

  makeView() {
    const head = this.now.clone().day(0);
    const lines: string[] = [];
    for (let i = 0; i < 7; i++) {
      lines.push(head.format("YYYY/MM/DD (ddd)"));
      head.add(1, "days");
    }
    return lines.join("\n");
  }
}

abstract class View {
  abstract receiveCommand(): ResultOfCommand;
  abstract makeView(): string;
}
