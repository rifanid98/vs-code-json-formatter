import * as vscode from 'vscode';
import { JsonFormatterPanel } from './panels/JsonFormatterPanel';

export function activate(context: vscode.ExtensionContext): void {
    const provider = new JsonFormatterPanel();

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            JsonFormatterPanel.viewType,
            provider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    const commands: [string, string][] = [
        ['jsonFormatter.expand', 'expand'],
        ['jsonFormatter.collapse', 'collapse'],
        ['jsonFormatter.stripQuotes', 'stripQuotes'],
    ];

    for (const [commandId, messageType] of commands) {
        context.subscriptions.push(
            vscode.commands.registerCommand(commandId, () => {
                provider.postMessage({ type: messageType });
            })
        );
    }
}

export function deactivate(): void {}
