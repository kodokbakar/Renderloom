export interface Version {
  id: string;
  candidateId: string;
  versionNumber: number;
  parentVersionId?: string;
  promptSnapshot: string;
  jsxSourcePath: string;
  svgPath: string;
  pngPath: string;
  createdAt: string;
}
