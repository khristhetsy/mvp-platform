// pdfjs-dist ships no typings for the worker entry. extract-text.ts only
// imports it to hand pdfjs its main-thread handler (see ensurePdfWorker).
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
