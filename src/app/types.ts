export type Subtitle = {
    id: string;
    startMs: number;
    endMs: number;
    text: string;
  };
  
  export type EditState = {
    editingId: string | null;
    selectedId: string | null;
    isEditingText: boolean; // gates global shortcuts
  };
  