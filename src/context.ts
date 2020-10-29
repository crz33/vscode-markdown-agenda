import * as vscode from "vscode";

export class Context {
  // Const
  public static readonly appId = "markdown-agenda";
  public static readonly appName = "Markdown Agenda";
  // Property
  public readonly prefixOfDocumentScheme = Context.appId;
  public readonly prefixOfSettings = Context.appId;
  private outputChannel: vscode.OutputChannel | undefined = undefined;

  constructor(public vscodeContext: vscode.ExtensionContext) {
    this.outputChannel = this.getConf("debug") ? vscode.window.createOutputChannel(Context.appName) : undefined;
  }

  getConf(id: string): any {
    return vscode.workspace.getConfiguration(this.prefixOfSettings).get(id);
  }

  debug(text: string) {
    if (this.outputChannel) {
      const now = new Date();
      this.outputChannel.appendLine(
        now.toLocaleTimeString("en", { hour12: false }) +
          "." +
          String(now.getMilliseconds()).padStart(3, "0") +
          " " +
          text
      );
    }
  }
}
