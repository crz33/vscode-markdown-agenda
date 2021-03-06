import * as vscode from "vscode";
import { AgendaDataProvider } from "./agenda";
import { Context } from "./context";

export function activate(context: vscode.ExtensionContext) {
  // Application Context
  const appContext = new Context(context);
  appContext.debug("activate");

  // Agenda Scheme and Provider
  const agendaDataProvider = new AgendaDataProvider(appContext);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(appContext.prefixOfDocumentScheme, agendaDataProvider)
  );

  // Commands to be provided
  context.subscriptions.push(
    vscode.commands.registerCommand(`${appContext.prefixOfSettings}`, async () => {
      const uri = vscode.Uri.parse(`${appContext.prefixOfDocumentScheme}:agenda`);
      for (let doc of vscode.workspace.textDocuments) {
        appContext.debug(`opend document : ${doc.uri.path}`);
        // if (doc.uri.scheme === uri.scheme && doc.uri.path === uri.path) {
        //   // vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Active });
        //   return;
        // }
      }
      const doc = await vscode.workspace.openTextDocument(uri);
      vscode.window.showTextDocument(doc, { preview: false });
    })
  );
}

export function deactivate() {}
