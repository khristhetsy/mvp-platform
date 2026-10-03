// The iCapOS contract PDF renderer: Word file in, PDF out, nothing external.
import { readDocx } from "./model";
import { renderModel } from "./render";

export async function renderDocxToPdf(docx: Uint8Array | Buffer): Promise<Buffer> {
  return renderModel(await readDocx(docx));
}
