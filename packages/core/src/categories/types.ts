export interface Category {
  id: number;
  name: string;
  created_at: string;
}

export interface CreateCategoryInput {
  name: string;
}
