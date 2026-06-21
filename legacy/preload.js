const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	pickCharacterDirectory: () => ipcRenderer.invoke('character:pickDirectory'),
	loadCharacterFromDirectory: (directoryPath) =>
		ipcRenderer.invoke('character:loadFromDirectory', directoryPath),
	saveCharacterToDirectory: (directoryPath, character) =>
		ipcRenderer.invoke('character:saveToDirectory', { directoryPath, character }),
	getRecentDirectories: () => ipcRenderer.invoke('character:getRecentDirectories'),
	onCharacterOpenFromMenu: (callback) => {
		ipcRenderer.on('character:openBundleFromMenu', (_event, payload) => {
			callback(payload);
		});
	},
});
