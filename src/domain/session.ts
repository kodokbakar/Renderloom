export interface Session {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  providerId: string;
  modelId: string;
  styleId: string;
  dimensions: {
    width: number;
    height: number;
  };
}
