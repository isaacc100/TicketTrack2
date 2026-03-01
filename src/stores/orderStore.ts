import { create } from 'zustand';

export interface DraftItem {
  id: string; // temporary id
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers?: any;
  notes?: string;
}

interface OrderStore {
  items: DraftItem[];
  addItem: (item: Omit<DraftItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clear: () => void;
  subtotal: () => number;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  items: [],
  addItem: (item) => set((state) => {
    // Basic grouping logic (matching item and modifiers)
    const existingIndex = state.items.findIndex(i => 
      i.menuItemId === item.menuItemId && JSON.stringify(i.modifiers) === JSON.stringify(item.modifiers) && i.notes === item.notes
    );

    if (existingIndex >= 0) {
      const newItems = [...state.items];
      newItems[existingIndex].quantity += item.quantity;
      return { items: newItems };
    }

    return {
      items: [
        ...state.items,
        { ...item, id: Math.random().toString(36).substr(2, 9) }
      ]
    };
  }),
  removeItem: (id) => set((state) => ({
    items: state.items.filter(i => i.id !== id)
  })),
  updateQuantity: (id, quantity) => set((state) => ({
    items: state.items.map(i => i.id === id ? { ...i, quantity } : i)
  })),
  clear: () => set({ items: [] }),
  subtotal: () => {
    const items = get().items;
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }
}));
