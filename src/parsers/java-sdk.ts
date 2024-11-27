import { Page } from "../page-ast";

export class JavaSdkPageParser {
  private page: Page = new Page();
  // Not required to be "$", but this is cheerio's convention
  private $: cheerio.Root;

  constructor(root: cheerio.Root) {
    this.$ = root;
  }

  // TODO: Figure out how to handle a mix of plaintext, paragraphs, anchor tags, inline code, etc.
  extractText (element: cheerio.Element | cheerio.Element[]): string {
    const getText = (element: cheerio.Element | cheerio.Element[]): string => {
      let res = '';

      if (Array.isArray(element)) {
        for (const child of element) {
          res += getText(child);
        }
      } else {
        if (element.type === 'tag') {
          for (const child of element.children) {
            res += getText(child);
          }
          return res;
        }
      
        if (element.type === 'text' && element.data) {
          return res += element.data;
        }
      }

      return res;
    };
    
    const res = getText(element);
    return res.replace(/\n/g, '');
  }

  getTagChildren(parent: cheerio.TagElement, name?: string): cheerio.TagElement[] {
    if (!parent.childNodes) {
      return [];
    }

    return (parent.childNodes.filter((child) => child.type === 'tag' && (!name || child.name === name)) as cheerio.TagElement[]);
  };

  handleHeading(heading: cheerio.TagElement) {
    const headingText = this.extractText(heading);
    const headingDepth = parseInt(heading.name[1]) - 1;
    this.page.addHeading(headingText, headingDepth);
  };

  handleTitleHeading(heading: cheerio.TagElement) {
    const headingContent = heading.attribs.title;
    this.page.addHeading(headingContent, 0);
  };

  handleMethodSummarySection(section: cheerio.TagElement) {
    // Assumes that there is only ever a heading and a summary table in this section
    // For some reason, text nodes are found in between the heading and table... Maybe we don't use cheerio?
    const tagChildren = this.getTagChildren(section);
    if (tagChildren.length !== 2) {
      throw new Error(`Expected 2 children for method-summary, but found ${tagChildren.length} instead.`);
    }
    const [heading, summaryTableContainer] = tagChildren;
    this.handleHeading(heading);

    const summaryTable = this.$(`#${summaryTableContainer.attribs.id} .summary-table`);
    this.page.add('.. list-table::');
    this.page.indent();
    this.page.addNewline();
    this.page.add(':header-rows: 1\n\n');

    // TODO: Maybe get rid of handling method summary section and create a handler for the actual summary table instead?
    // Should only need to break out an element if it's a special case or its children require a shared context
    let index = 0;
    for (const cell of summaryTable.children()) {
      if (cell.type === 'tag') {
        // TODO: Un-hardcode "3"
        const isFirstCellInRow = index % 3 === 0;
        const isLastCellInRow = index % 3 === 2;
        const listElementPrefix = isFirstCellInRow ? '* -' : '-';
        
        if (!isFirstCellInRow) {
          this.page.indent(2);
        }

        this.page.addNewline();
        // TODO: Figure out how to get anchor links when extracting text
        this.page.add(`${listElementPrefix} ${this.extractText(cell.children)}`);

        if (!isFirstCellInRow) {
          this.page.dedent(2);
        }

        if (isLastCellInRow) {
          this.page.addNewline();
        }

        index++;
      }
    }

    this.page.dedent();
    this.page.addNewline();
  }

  handleDetail(element: cheerio.TagElement): void {
    console.log({ element });
  };

  // TODO: Need to take into account nested annotations. Maybe split it into its own handler?
  handleMemberSignature(element: cheerio.TagElement): void {
    const text = this.extractText(element.children);
    this.page.addCodeBlock({ text, lang: 'java' });
  };
  
  handleNotes(element: cheerio.TagElement): void {
    // TODO: Need to check if snooty-parser can handle different field lists
    // console.log({ notes: element })
    console.log('Handling notes');
    for (const child of element.children) {
      console.log({ child });
      this.handleElement(child);
    }
  };

  handleElement(element: cheerio.Element): void {
    if (element.type === 'tag') {
      this.handleTagElement(element);
    } else if (element.type === 'text') {
      this.handleTextElement(element);
    }
  };

  handleTextElement(element: cheerio.TextElement): void {
    // console.log({ text: element.data });
  };
  
  handleTagElement(element: cheerio.TagElement): void {
    const className = element.attribs.class;
    const tagName = element.name;

    if (className === 'title') {
      this.handleTitleHeading(element);
    } 
    else if (className === 'type-signature') {
      this.handleTypeSignature(element);
    } 
    // TODO: Need to consider other elements too. See note for extractText() function
    else if (className === 'block') {
      const text = this.extractText(element);
      this.page.add(text);
      this.page.addDoubleNewline();
    } 
    else if (className === 'method-summary') {
      this.handleMethodSummarySection(element);
    } 
    else if (className === 'member-signature') {
      this.handleMemberSignature(element);
    }
    else if (className === 'notes') {
      this.handleNotes(element);
    }
    // else if (className === 'method-details') {
    //   this.handleMethodDetails(element);
    // } 
    // else if (className === 'detail') {
    //   this.handleDetail(element);
    // } 
    else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      this.handleHeading(element);
    }
    // else if () {

    // }
    else {
      for (const child of element.children) {
        if (child.type === 'tag') {
          this.handleTagElement(child);
        }
      }
    }
  };

  handleTypeSignature = (element: cheerio.TagElement): void => {  
    const handleAnnotation = (annotation: cheerio.TagElement): void => {
      // TODO: Need to fix this to account for multiple links
      const [link] = annotation.children;
      if (link.type === 'tag' && link.name === 'a') {
        const refuri = link.attribs.href;
        const text = this.extractText(link.children);
        this.page.add(`\`${text} <${refuri}>\`__`);
        this.page.addDoubleNewline();
      }
    };
  
    let codeString = '';
    for (const child of element.children) {
      if (child.type === 'tag' && child.attribs.class === 'annotations') {
        handleAnnotation(child);
      } else if (child.type === 'tag' && child.name === 'span') {
        // Assume everything else will be concatenated into a single code block
        codeString += this.extractText(child);
      }
    }
  
    if (codeString) {
      this.page.addCodeBlock({ text: codeString, lang: 'java' });
    }
  }

  parse(contentRoot: cheerio.Cheerio) {
    for (const element of contentRoot.children()) {
      if (element.type === 'tag') {
        this.handleTagElement(element);
      }
    }
  }

  toString() {
    return this.page.toRst();
  }
};
