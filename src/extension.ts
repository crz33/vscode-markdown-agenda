import * as vscode from "vscode";
import { AgendaDataProvider } from "./agenda";

export function activate(context: vscode.ExtensionContext) {
  // Prefix of this extention
  const agendaPrefix = "markdown-agenda";

  // Agenda Scheme and Provider
  const agendaDataProvider = new AgendaDataProvider();
  const agendaScheme = agendaPrefix;
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(agendaScheme, agendaDataProvider));

  // Commands to be provided
  context.subscriptions.push(
    vscode.commands.registerCommand(`${agendaPrefix}`, async () => {
      const uri = vscode.Uri.parse(`${agendaScheme}: agenda`);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });
    })
  );

  // Agenda Commands
  agendaDataProvider.bindCommands(context);
}

export function deactivate() {}
