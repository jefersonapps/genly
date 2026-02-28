
export interface LatexResult {
  latex: string;
  style: string;
  uri: string;
  index: number | null;
}

type LatexListener = (result: LatexResult) => void;

class LatexStateService {
  private listeners: LatexListener[] = [];

  onResult(listener: LatexListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify(result: LatexResult) {
    this.listeners.forEach((l) => l(result));
  }
}

export const latexStateService = new LatexStateService();
