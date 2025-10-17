/**
 * WorkspaceLike interface: Represents the minimal workspace API required for scanning docs.
 * - findFiles: Used to search for files matching patterns.
 * - getConfiguration: Used to read extension settings (optional).
 */
export interface WorkspaceLike {
	findFiles: (pattern: string, exclude?: string, maxResults?: number) => Thenable<any[]>;
	getConfiguration?: (section: string) => { get: (key: string) => any };
}
