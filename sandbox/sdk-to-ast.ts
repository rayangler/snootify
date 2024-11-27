/**
 * This file is intended to contain POC code for an AST approach.
 */

import axios from 'axios';
// import { parse } from 'node-html-parser';
import * as cheerio from 'cheerio';

// Maybe turn these into classes to make it easier to fill out types? But then we'd have to worry about serializing
interface Node {
  type: string;
};

interface Parent extends Node {
  children: Node[];
}

interface Root extends Parent {
  options: Record<string, any>;
  fileid?: string;
};

interface Heading extends Parent {
  id: string;
};

type Paragraph = Parent;

interface Reference extends Parent {
  refuri: string;
};

interface Text extends Node {
  value: string;
};

interface Code extends Node {
  lang: string;
  copyable: boolean;
  // Parser currently uses snake_case here
  emphasize_lines: number[];
  value: string;
  linenos: boolean;
};

const PAGE_SOURCE_URL = 'https://raw.githubusercontent.com/mongodb/mongo-java-driver/refs/heads/gh-pages/5.2/apidocs/mongodb-driver-sync/com/mongodb/client/gridfs/GridFSBucket.html';

const getPageContent = async () => {
  const { data } = await axios.get(PAGE_SOURCE_URL);
  return data;
};

// Creating nodes through functions for now to avoid needing to worry about serialization later. Probably good to organize
// with functions though.
const createEmptyAstNode = (type: string): Node => {
  return { type };
};

const createEmptyParentNode = (type: string): Parent => {
  return ({
    ...createEmptyAstNode(type),
    children: [],
  });
};

const createSectionNode = (): Parent => {
  return createEmptyParentNode('section');
};

const createReferenceNode = (refuri: string): Reference => {
  return ({
    ...createEmptyParentNode('reference'),
    refuri,
  });
};

const createTextNode = (value: string): Text => {
  return ({
    ...createEmptyAstNode('text'),
    value,
  });
};

const createCodeNode = ({ lang, copyable, value }: { lang?: string; copyable?: boolean; value: string }): Code => {
  return ({
    type: 'code',
    lang: lang ?? 'java',
    copyable: copyable ?? false,
    value,
    emphasize_lines: [],
    linenos: false,
  });
}

const createHeadingNode = (element: cheerio.TagElement): Heading => {
  // TODO: Turn this into html hash id
  const headingId = element.attribs.title;
  const headingContent = element.attribs.title;

  const headingNode: Heading = ({
    ...createEmptyParentNode('heading'),
    id: headingId,
  });
  
  headingNode.children.push(createTextNode(headingContent));
  return headingNode;
}

const handleTitleHeading = (heading: cheerio.TagElement, head: Parent) => {
  const sectionNode = createSectionNode();
  sectionNode.children.push(createHeadingNode(heading));
  head.children.push(sectionNode);
};

const extractText = (element: cheerio.Element): string => {
  let res = '';

  if (element.type === 'tag') {
    for (const child of element.children) {
      res += extractText(child);
    }
    return res;
  }

  if (element.type === 'text' && element.data) {
    return res += element.data;
  }

  return res;
}

const handleTypeSignature = (element: cheerio.TagElement, head: Parent): void => {
  console.log(element.children);

  const handleAnnotation = (annotation: cheerio.TagElement): void => {
    const [link] = annotation.children;
    if (link.type === 'tag' && link.name === 'a') {
      const paragraphNode = createEmptyParentNode('paragraph');
      const refuri = link.attribs.href;
      paragraphNode.children.push(createReferenceNode(refuri));
      head.children.push(paragraphNode);
    }
  };

  let codeString = '';
  for (const child of element.children) {
    if (child.type === 'tag' && child.attribs.class === 'annotations') {
      handleAnnotation(child);
    } else if (child.type === 'tag' && child.name === 'span') {
      // Assume everything else will be concatenated into a single code block
      codeString += extractText(child);
    }
  }

  if (codeString) {
    const codeNode = createCodeNode({ lang: 'java', value: codeString });
    head.children.push(codeNode);
  }
}

const handleTagElement = (element: cheerio.TagElement, head: Parent): void => {
  const className = element.attribs.class;
  if (className === 'title') {
    handleTitleHeading(element, head);
  } else if (className === 'type-signature') {
    handleTypeSignature(element, head);
  } else if (className === 'block') {
    const text = extractText(element);
    head.children.push(createTextNode(text));
  } else if (className === 'method-summary') {
    console.log('Method summary');
    console.log(element);
  } else {
    console.log({className});

    for (const child of element.children) {
      if (child.type === 'tag') {
        console.log(`Child ${child.attribs.class} has ${child.children.length} children`);
        handleTagElement(child, head);
      }
    }
    // head.children.push(createEmptyAstNode(element.attribs.class));
  }
};

const handleText = () => {

};

const parseHeader = (headerElement: cheerio.TagElement, head: Parent): void => {
  for (const child of headerElement.children) {
    if (child.type === 'tag') {
      handleTagElement(child, head);
    } else if (child.type === 'text') {
      handleText();
    }
  }
};

const instanceOfParent = (item: any): item is Parent => {
  return 'children' in item;
};

const main = async () => {
  console.log('Starting...');
  console.log('Getting page content...');
  const pageHtml = await getPageContent();

  console.log('Parsing page content...');
  const $ = cheerio.load(pageHtml);

  const contentRoot = $('main');
  const ast: Root = {
    ...createEmptyParentNode('root'),
    options: {},
  };

  let head: Parent = ast;
  for (const element of contentRoot.children()) {
    if (element.type === 'tag') {
      // Parse this in a unique way because Snooty AST expects everything in main content to be nested in a section with the
      // first heading
      if (element.attribs.class === 'header') {
        parseHeader(element, head);
        const lastAstChild = ast.children[ast.children.length - 1];
        if (instanceOfParent(lastAstChild)) {
          head = lastAstChild;
        }
      } else {
        handleTagElement(element, head);
      }
    }
  }

  console.log(JSON.stringify(ast, null, 2));
};

main()
  .then(() => console.log('Done'))
  .catch((e) => console.error(e));
