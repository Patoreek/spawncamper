import { testDBConnection } from "./db/db";
import { createProduct } from "./products/service";
import { mockNewProduct, CreateProductInput } from "./products/types";
// testDBConnection();
const testProduct: CreateProductInput = mockNewProduct; 
const result = createProduct(testProduct);
console.log('RESULT:', result);