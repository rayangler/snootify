type Rst = { indent: number; text: string };

const HEADING_MAPPING: Record<number, string> = {
  0: '=',
  1: '-',
  2: '~',
  3: '^',
  4: '`',
  5: '#'
};

export class Page {
  private rst: Rst[] = [];
  private indentationLevel = 0;

  toRst(): string {
    // Debugging
    // console.log(this.rst);
    return this.rst
      .map(({ indent, text }) => {
        const indentString = new Array(indent).fill(" ").join("");
        return text.replace(/\n/g, `\n${indentString}`);
      })
      .join("");
  }

  add(text: string) {
    this.rst.push({
      indent: this.indentationLevel,
      text,
    });
  }

  addNewline() {
    this.add('\n');
  }

  addDoubleNewline() {
    this.add('\n\n');
  }

  addHeading(text: string, depth: number) {
    this.add(text);
    this.addNewline();
    this.add(HEADING_MAPPING[depth].repeat(text.length));
    this.addDoubleNewline();
  }

  addCodeBlock({ text, lang, copyable } : { text: string, lang?: string, copyable?: boolean }) {
    this.add(`.. code:: ${lang ?? 'none'}`);
    // Not the prettiest
    this.addNewline();
    this.indent();
    this.addNewline();
    this.add(text);
    this.dedent();
    this.addDoubleNewline();
  }

  indent(spaces = 3) {
    this.indentationLevel += spaces;
  }

  dedent(spaces = 3) {
    this.indentationLevel -= spaces;
  }

  indented(text: string, spaces?: number) {
    this.indent(spaces);
    this.add(text);
    this.dedent(spaces);
  }
};
