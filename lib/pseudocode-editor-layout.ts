export type ScrollPosition = {
  scrollTop: number;
  scrollLeft: number;
};

export function synchroniseEditorScroll(source: ScrollPosition, ...targets: ScrollPosition[]) {
  for (const target of targets) {
    target.scrollTop = source.scrollTop;
    target.scrollLeft = source.scrollLeft;
  }
}
