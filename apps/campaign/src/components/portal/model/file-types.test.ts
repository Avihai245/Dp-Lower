import { DOC_MAX_BYTES } from '@dpl/core';
import { describe, expect, it } from 'vitest';
import { checkFile, familyOfMime, FILE_ACCEPT, mimeOfFamily, resolveMimeType, sniffFamily } from './file-types';

const bytes = (...v: number[]) => new Uint8Array(v);
const text = (s: string) => new TextEncoder().encode(s);

describe('resolveMimeType', () => {
  it('trusts an allowed declared type', () => {
    expect(resolveMimeType({ name: 'a.pdf', type: 'application/pdf' })).toBe('application/pdf');
    expect(resolveMimeType({ name: 'a.bin', type: 'image/webp' })).toBe('image/webp');
  });

  it('falls back to the extension when the browser gives no usable type', () => {
    expect(resolveMimeType({ name: 'IMG_0001.HEIC', type: '' })).toBe('image/heic');
    expect(resolveMimeType({ name: 'scan.heif', type: 'application/octet-stream' })).toBe('image/heif');
    expect(resolveMimeType({ name: 'notes.docx', type: '' })).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(resolveMimeType({ name: 'photo.JPG', type: 'image/jpg' })).toBe('image/jpeg');
    expect(resolveMimeType({ name: 'תעודת לידה.pdf', type: '' })).toBe('application/pdf');
  });

  it('refuses everything else', () => {
    expect(resolveMimeType({ name: 'run.exe', type: 'application/x-msdownload' })).toBeNull();
    expect(resolveMimeType({ name: 'page.html', type: 'text/html' })).toBeNull();
    expect(resolveMimeType({ name: 'noextension', type: '' })).toBeNull();
    expect(resolveMimeType({ name: 'old.doc', type: 'application/msword' })).toBeNull();
  });

  it('lists the extensions and types in accept=', () => {
    expect(FILE_ACCEPT).toContain('.pdf');
    expect(FILE_ACCEPT).toContain('.heic');
    expect(FILE_ACCEPT).toContain('.docx');
    expect(FILE_ACCEPT).toContain('image/jpeg');
  });
});

describe('checkFile', () => {
  it('accepts a normal file', () => {
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 1024 })).toEqual({ ok: true, mimeType: 'application/pdf' });
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: DOC_MAX_BYTES })).toMatchObject({ ok: true });
  });

  it('rejects empty, oversized and unsupported files', () => {
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 0 })).toEqual({ ok: false, reason: 'empty' });
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: DOC_MAX_BYTES + 1 })).toEqual({ ok: false, reason: 'size' });
    expect(checkFile({ name: 'a.exe', type: 'application/octet-stream', size: 10 })).toEqual({ ok: false, reason: 'type' });
  });
});

describe('sniffFamily', () => {
  it('recognises the allowed kinds by their signature', () => {
    expect(sniffFamily(text('%PDF-1.7\n'))).toBe('pdf');
    expect(sniffFamily(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe('jpeg');
    expect(sniffFamily(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe('png');
    expect(sniffFamily(text('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '))).toBe('webp');
    expect(sniffFamily(bytes(0, 0, 0, 0x18, ...text('ftypheic'), 0, 0, 0, 0))).toBe('heic');
    expect(sniffFamily(bytes(0, 0, 0, 0x18, ...text('ftypmif1'), 0, 0, 0, 0))).toBe('heic');
    expect(sniffFamily(bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0, 6, 0))).toBe('docx');
  });

  it('rejects scripts, executables and other formats', () => {
    expect(sniffFamily(text('<!doctype html><script>'))).toBeNull();
    expect(sniffFamily(text('MZ\u0090\u0000\u0003'))).toBeNull();
    expect(sniffFamily(text('GIF89a'))).toBeNull();
    expect(sniffFamily(bytes(0, 0, 0, 0x18, ...text('ftypmp42'), 0, 0, 0, 0))).toBeNull();
    expect(sniffFamily(bytes())).toBeNull();
    expect(sniffFamily(bytes(0x25, 0x50))).toBeNull();
  });
});

describe('families and canonical types', () => {
  it('maps declared types to families and back', () => {
    expect(familyOfMime('image/heif')).toBe('heic');
    expect(familyOfMime('application/pdf')).toBe('pdf');
    expect(familyOfMime('text/plain')).toBeNull();
    expect(mimeOfFamily('jpeg')).toBe('image/jpeg');
    expect(mimeOfFamily('heic', 'image/heif')).toBe('image/heif');
    expect(mimeOfFamily('heic', 'image/jpeg')).toBe('image/heic');
    expect(mimeOfFamily('docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });
});
