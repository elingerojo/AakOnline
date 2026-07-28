import { Injectable } from '@angular/core';
import { marked } from 'marked';

@Injectable({ providedIn: 'root' })
export class MarkdownService {
  private renderer: typeof marked;

  constructor() {
    this.renderer = marked;
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
  }

  /**
   * Converts a Markdown string to safe HTML.
   */
  toHtml(markdown: string): string {
    if (!markdown) return '';
    const result = this.renderer.parse(markdown);
    return typeof result === 'string' ? result : '';
  }

  /**
   * Strips Markdown formatting and returns plain text.
   */
  toPlainText(markdown: string): string {
    if (!markdown) return '';
    return markdown
      .replace(/[#*_~`>\[\]()!-]/g, '')
      .replace(/\n{2,}/g, ' ')
      .trim();
  }
}
