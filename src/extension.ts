import * as vscode from "vscode";
import { AgendaDataProvider } from "./agendaView";

export function activate(context: vscode.ExtensionContext) {
  const agendaDataProvider = new AgendaDataProvider();
  vscode.window.registerTreeDataProvider("markdownAgenda", agendaDataProvider);
}

export function deactivate() {}
