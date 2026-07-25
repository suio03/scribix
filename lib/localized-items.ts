export function assertLocalizedItemCount(
  copy: unknown,
  definitions: readonly unknown[],
  source: string
): asserts copy is readonly unknown[] {
  if (!Array.isArray(copy)) {
    throw new Error(`${source} must be an array.`);
  }

  if (copy.length !== definitions.length) {
    throw new Error(
      `${source} has ${copy.length} translated items but ${definitions.length} definitions.`
    );
  }
}

export function mergeLocalizedItems<
  Copy extends object,
  Definition extends object,
>(
  copy: readonly Copy[],
  definitions: readonly Definition[],
  source: string
): Array<Copy & Definition> {
  assertLocalizedItemCount(copy, definitions, source);

  return definitions.map((definition, index) => ({
    ...definition,
    ...copy[index],
  }));
}
