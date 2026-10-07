// Store each project separately so saving one project cannot overwrite another.
const PROJECT_PREFIX = 'bridgeai_project_';
export async function listProjects(): Promise<import('./projectMemory').ProjectMemory[]> {
    const items = await chrome.storage.local.get(null);
    return Object.entries(items)
        .filter(([key, value]) => key.startsWith(PROJECT_PREFIX) && value?.version === 1)
        .map(([, value]) => value as import('./projectMemory').ProjectMemory)
        .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveProject(project: import('./projectMemory').ProjectMemory): Promise<void> {
    await chrome.storage.local.set({ [PROJECT_PREFIX + project.id]: { ...project, updatedAt: Date.now() } });
}

export async function deleteProject(id: string): Promise<void> {
    await chrome.storage.local.remove(PROJECT_PREFIX + id);
}
