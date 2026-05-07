export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SafeAreaOptions {
  onChange?: (insets: SafeAreaInsets) => void;
}

export interface SafeAreaInstance {
  getInsets(): SafeAreaInsets;
  destroy(): void;
}
