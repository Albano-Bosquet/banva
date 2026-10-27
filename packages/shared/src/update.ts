/** Estado de actualización del proyecto desde GitHub (API /api/update). */
export interface UpdateCommit {
  hash: string;
  subject: string;
  author: string;
  date: string;
}

export interface UpdateFile {
  /** Letra de `git diff --name-status`: A agregado, M modificado, D eliminado, R renombrado. */
  status: string;
  path: string;
}

export interface UpdateStatus {
  /** false si la carpeta no es un repositorio con rama remota, o si quien pregunta no es esta computadora. */
  enabled: boolean;
  reason?: string;
  branch?: string;
  current?: string;
  remote?: string;
  /** Commits del repositorio remoto que todavía no están acá. */
  behind: number;
  /** Commits locales que no están en el remoto (si hay, no se puede avanzar sin fusionar). */
  ahead: number;
  commits: UpdateCommit[];
  files: UpdateFile[];
  /** Archivos versionados con cambios sin guardar en git: pueden bloquear la actualización. */
  dirty: string[];
  checkedAt: string;
  error?: string;
}

export interface PullResult {
  ok: boolean;
  from: string;
  to: string;
  commits: UpdateCommit[];
  files: UpdateFile[];
  /** Se corrió `npm install` porque cambiaron las dependencias. */
  installed: boolean;
  error?: string;
}
