export interface DumpWriter {
  dump<TData>(title: string, content: TData): Promise<void>;
}
