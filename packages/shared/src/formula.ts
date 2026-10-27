/**
 * Motor de fórmulas mínimo para tablas y hojas de cálculo.
 * Celdas que empiezan con "=" se evalúan: números, referencias (A1), rangos (A1:B3),
 * + - * / ^, paréntesis y funciones SUMA/SUM, PROMEDIO/AVERAGE, MIN, MAX, CONTAR/COUNT, REDONDEAR/ROUND.
 */

export type CellValue = number | string;

const FUNCS: Record<string, (args: number[]) => number> = {
  SUM: (a) => a.reduce((s, x) => s + x, 0),
  AVERAGE: (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0),
  MIN: (a) => (a.length ? Math.min(...a) : 0),
  MAX: (a) => (a.length ? Math.max(...a) : 0),
  COUNT: (a) => a.length,
  ROUND: (a) => {
    const f = 10 ** (a[1] ?? 0);
    return Math.round((a[0] ?? 0) * f) / f;
  },
};
const ALIASES: Record<string, string> = { SUMA: 'SUM', PROMEDIO: 'AVERAGE', CONTAR: 'COUNT', REDONDEAR: 'ROUND' };

export class FormulaError extends Error {}

/** "B3" → { row: 2, col: 1 } (índices desde 0). */
export function parseRef(ref: string): { row: number; col: number } | null {
  const m = /^([A-Z]+)(\d+)$/i.exec(ref);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: parseInt(m[2], 10) - 1, col: col - 1 };
}

export function colName(col: number): string {
  let s = '';
  let n = col + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Interpreta texto de celda como número: "1200", "1.200,50", "$ 30", "-4.5", "15%". */
export function toNumber(text: string): number | null {
  let t = text.trim().replace(/[$€\s]/g, '');
  if (!t) return null;
  let pct = false;
  if (t.endsWith('%')) {
    pct = true;
    t = t.slice(0, -1);
  }
  let n: number | null = null;
  if (/^-?\d+(\.\d+)?$/.test(t)) n = parseFloat(t);
  else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) || /^-?\d+,\d+$/.test(t)) n = parseFloat(t.replace(/\./g, '').replace(',', '.'));
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) n = parseFloat(t.replace(/,/g, ''));
  if (n === null || !Number.isFinite(n)) return null;
  return pct ? n / 100 : n;
}

type Token = { t: 'num'; v: number } | { t: 'ref'; v: string } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (num) {
      out.push({ t: 'num', v: parseFloat(num[0]) });
      i += num[0].length;
      continue;
    }
    const word = /^[A-Za-z]+\d*/.exec(src.slice(i));
    if (word) {
      const w = word[0].toUpperCase();
      out.push(/\d$/.test(w) ? { t: 'ref', v: w } : { t: 'id', v: w });
      i += w.length;
      continue;
    }
    if ('+-*/^(),;:'.includes(c)) {
      out.push({ t: 'op', v: c === ';' ? ',' : c });
      i++;
      continue;
    }
    throw new FormulaError(`carácter inesperado "${c}"`);
  }
  return out;
}

/** Evalúa todas las celdas; devuelve el valor calculado de cada una. */
export function evaluateCells(cells: string[][]): CellValue[][] {
  const cache = new Map<string, CellValue>();
  const visiting = new Set<string>();

  const cellValue = (row: number, col: number): CellValue => {
    const key = `${row}:${col}`;
    if (cache.has(key)) return cache.get(key)!;
    const raw = cells[row]?.[col] ?? '';
    if (!raw.startsWith('=')) {
      const n = toNumber(raw);
      const v = n ?? raw;
      cache.set(key, v);
      return v;
    }
    if (visiting.has(key)) throw new FormulaError('#CICLO');
    visiting.add(key);
    let v: CellValue;
    try {
      v = evalFormula(raw.slice(1));
    } catch (e) {
      v = e instanceof FormulaError && e.message.startsWith('#') ? e.message : '#ERROR';
    }
    visiting.delete(key);
    cache.set(key, v);
    return v;
  };

  const numAt = (row: number, col: number): number | null => {
    const v = cellValue(row, col);
    if (typeof v === 'string' && v.startsWith('#')) throw new FormulaError(v);
    return typeof v === 'number' ? v : null;
  };

  function evalFormula(src: string): number {
    const toks = tokenize(src);
    let p = 0;
    const peek = () => toks[p];
    const eat = (v?: string) => {
      const tk = toks[p];
      if (!tk || (v !== undefined && !(tk.t === 'op' && tk.v === v))) throw new FormulaError(`se esperaba ${v ?? 'expresión'}`);
      p++;
      return tk;
    };
    const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;

    const expr = (): number => {
      let v = term();
      while (isOp('+') || isOp('-')) {
        const op = eat().v;
        const r = term();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    };
    const term = (): number => {
      let v = power();
      while (isOp('*') || isOp('/')) {
        const op = eat().v;
        const r = power();
        if (op === '/' && r === 0) throw new FormulaError('#DIV/0');
        v = op === '*' ? v * r : v / r;
      }
      return v;
    };
    const power = (): number => {
      const b = unary();
      if (isOp('^')) {
        eat();
        return b ** power();
      }
      return b;
    };
    const unary = (): number => {
      if (isOp('-')) {
        eat();
        return -unary();
      }
      if (isOp('+')) {
        eat();
        return unary();
      }
      return primary();
    };
    // Argumentos de función: expresiones o rangos (que aportan varios números).
    const args = (): number[] => {
      const out: number[] = [];
      if (isOp(')')) return out;
      for (;;) {
        const a = toks[p];
        const b = toks[p + 1];
        const c = toks[p + 2];
        if (a?.t === 'ref' && b?.t === 'op' && b.v === ':' && c?.t === 'ref') {
          p += 3;
          out.push(...rangeValues(a.v, c.v));
        } else out.push(expr());
        if (isOp(',')) eat();
        else break;
      }
      return out;
    };
    const rangeValues = (from: string, to: string): number[] => {
      const a = parseRef(from);
      const b = parseRef(to);
      if (!a || !b) throw new FormulaError('#REF');
      const vals: number[] = [];
      for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++)
        for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) {
          const n = numAt(r, c);
          if (n !== null) vals.push(n);
        }
      return vals;
    };
    const primary = (): number => {
      const tk = eat();
      if (tk.t === 'num') return tk.v;
      if (tk.t === 'ref') {
        const ref = parseRef(tk.v);
        if (!ref || ref.row >= cells.length || ref.row < 0) throw new FormulaError('#REF');
        return numAt(ref.row, ref.col) ?? 0;
      }
      if (tk.t === 'id') {
        const name = ALIASES[tk.v] ?? tk.v;
        const fn = FUNCS[name];
        if (!fn) throw new FormulaError('#NOMBRE');
        eat('(');
        const a = args();
        eat(')');
        return fn(a);
      }
      if (tk.v === '(') {
        const v = expr();
        eat(')');
        return v;
      }
      throw new FormulaError('expresión inválida');
    };

    const v = expr();
    if (p < toks.length) throw new FormulaError('sobra texto');
    return v;
  }

  return cells.map((row, r) => row.map((_, c) => cellValue(r, c)));
}

/** Texto a mostrar: fórmulas con su resultado, números con hasta 2 decimales. */
export function displayCells(cells: string[][]): string[][] {
  const values = evaluateCells(cells);
  return cells.map((row, r) =>
    row.map((raw, c) => {
      if (!raw.startsWith('=')) return raw;
      const v = values[r][c];
      return typeof v === 'number' ? formatNumber(v) : v;
    }),
  );
}

export function formatNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString('es-AR', { maximumFractionDigits: 2 });
}
