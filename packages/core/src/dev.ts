import { testDBConnection } from "./db/db";
import { createProduct, getAllProducts, pauseProduct, activateProduct, archiveProduct, deleteProduct } from "./products/service";
import { mockNewProduct, CreateProductInput } from "./products/types";
testDBConnection();
const testProduct: CreateProductInput = mockNewProduct; 
const result = createProduct(testProduct);
// console.log('RESULT:', result);
let products = getAllProducts();
const PRODUCT_TO_DELETE = 2
console.log('----------------------------------------')
console.log("PRODUCTS:", products);
console.log('----------------------------------------')
pauseProduct(1);
console.log('----------------------------------------')
const product = getAllProducts();
console.log("PRODUCTS UPDATED:", product);
console.log('----------------------------------------')
const pauseOneProduct = pauseProduct(PRODUCT_TO_DELETE);
console.log("PRODUCT PAUSED:", pauseOneProduct);
console.log('----------------------------------------')
const activateOneProduct = activateProduct(PRODUCT_TO_DELETE);
console.log("PRODUCT ACTIVATED:", activateOneProduct);
console.log('----------------------------------------')
const archiveOneProduct = archiveProduct(PRODUCT_TO_DELETE);
console.log("PRODUCT ARCHIVE:", archiveOneProduct);
console.log('----------------------------------------')
const deleteOneProduct = deleteProduct(PRODUCT_TO_DELETE);
console.log("PRODUCT DELETE:", deleteOneProduct);
console.log('----------------------------------------')





// TODO: helper function to convert created_at && updated_at time from UTC to respective timezone