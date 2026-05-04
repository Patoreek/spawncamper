import { checkPrice } from "@spawncamper/core";
const url = process.argv[2];
console.log(await checkPrice(url ? [url] : []));