// Create a product with URLS of products to watch
// Pause/Stop product
// Remove/Archive product
// Pass in URLS and look up items
// Search for price
// Compare price
// Store results (JSON? DB?)
// Return results (price, % up/down, website indiviudal prices, etc)
// send notification to telegram
// LATER: Purchase bot that has my credientials and can purchase a product?



const createProduct = async (product: []) => {
  const result = 0;
  return result;
}

const pauseProduct = async (id: string) => {
  const result = 0;
  return result;
}

const archiveProduct = async (id: string) => {
  const result = 0;
  return result;
}

const deleteProduct = async (id: string) => {
  const result = 0;
  return result;
}

const getActiveProducts = async (): Promise<string[]> => {
  return [];
} 

const storeResults = async (): Promise<string[]> => {
  return [];
}

const sendNotification = async (): Promise<string[]> => {
  return [];
} 

const logAction = async (): Promise<string[]> => {
  // Structured Log that keeps logs consistent of all actions
  return [];
} 

export const checkPrice = async (urls: string[]) => {
    // TODO
    const productData: string[] = await getActiveProducts();
    const newProductData: string[] = [];
    for (const url of urls) {
      const data = await getDataFromProductURL(url);
      newProductData.push(...data);
    }
    await comparePrice(productData, newProductData);

    return { urls, price: null as number | null, productData: newProductData };
};

const getDataFromProductURL = async (_url: string): Promise<string[]> => {
  return [];
};

const comparePrice = async (
  _productData: string[],
  _newProductData: string[]
): Promise<string[]> => {
  return [];
};
