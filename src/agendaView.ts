import * as vscode from "vscode";

export class AgendaDataProvider implements vscode.TreeDataProvider<AgendaItem> {
  getTreeItem(element: AgendaItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element?: AgendaItem): vscode.ProviderResult<AgendaItem[]> {
    return Promise.resolve([new AgendaItem("DEADLINED", "deadlined"), new AgendaItem("SCHEDULED", "scheduled")]);
  }
}

export class AgendaItem extends vscode.TreeItem {
  constructor(public label: string, public contextValue: string) {
    super(label);
    this.tooltip = `${label} - tooltip`;
    this.description = `${label} - description`;
  }
}
