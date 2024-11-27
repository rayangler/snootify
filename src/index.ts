import axios from 'axios';
import * as cheerio from 'cheerio';
import { JavaSdkPageParser } from './parsers/java-sdk';

const PAGE_SOURCE_URL = 'https://raw.githubusercontent.com/mongodb/mongo-java-driver/refs/heads/gh-pages/5.2/apidocs/mongodb-driver-sync/com/mongodb/client/gridfs/GridFSBucket.html';

async function getPageContent() {
  const { data } = await axios.get(PAGE_SOURCE_URL);
  return data;
};

async function main() {
  const htmlContent = await getPageContent();

  const $ = cheerio.load(htmlContent);
  const contentRoot = $('main');

  const pageParser = new JavaSdkPageParser($);
  pageParser.parse(contentRoot);

  // For debugging
  console.log(pageParser.toString());
};

main()
  .then(() => console.log('Done'))
  .catch((e) => console.error(e));
