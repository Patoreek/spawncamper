import { testDBConnection } from "./db/db";
import { createProduct, getAllProducts } from "./products/service";
import { mockNewProduct, CreateProductInput } from "./products/types";
testDBConnection();
// const testProduct: CreateProductInput = mockNewProduct; 
// const result = createProduct(testProduct);
// console.log('RESULT:', result);
const products = getAllProducts();
console.log("PRODUCTS:", products);

// TODO: helper function to convert created_at && updated_at time from UTC to respective timezone