import { testDBConnection } from "./db/db";
import { createProduct, getAllProducts, pauseProduct } from "./products/service";
import { mockNewProduct, CreateProductInput } from "./products/types";
testDBConnection();
// const testProduct: CreateProductInput = mockNewProduct; 
// const result = createProduct(testProduct);
// console.log('RESULT:', result);
let products = getAllProducts();
console.log("PRODUCTS:", products);
pauseProduct(1);
products = getAllProducts();
console.log("PRODUCTS UPDATED:", products);


// TODO: helper function to convert created_at && updated_at time from UTC to respective timezone