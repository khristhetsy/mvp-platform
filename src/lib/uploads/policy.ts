export const PDF_ONLY = {
  mime: ['application/pdf'],
  ext: ['.pdf'],
  label: 'PDF',
  maxBytes: 25 * 1024 * 1024,
} as const;
export type UploadPolicy = typeof PDF_ONLY;
export function validateFile(file: { name: string; type: string; size: number }, policy: UploadPolicy) {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!(policy.ext as readonly string[]).includes(ext) || !(policy.mime as readonly string[]).includes(file.type)) {
    return { ok: false as const, message: `Only ${policy.label} files can be uploaded. Please convert this document to PDF and try again.` };
  }
  if (file.size > policy.maxBytes) {
    return { ok: false as const, message: `File exceeds the ${Math.round(policy.maxBytes / 1024 / 1024)}MB limit.` };
  }
  return { ok: true as const };
}
