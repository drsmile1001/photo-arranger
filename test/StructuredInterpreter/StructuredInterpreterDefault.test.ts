import { describe, expect, test } from "bun:test";

import type { ExecutionContext } from "~shared/StructuredInterpreter/StructuredInterpreter";
import { StructuredInterpreterDefault } from "~shared/StructuredInterpreter/StructuredInterpreterDefault";
import { expectOk } from "~shared/testkit/ExpectResult";
import { ok } from "~shared/utils/Result";

describe("StructuredInterpreterDefault", () => {
  test("可以正確解釋字面量表達式", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const numberResult = await interpreter.interpret({ value: 42 });
    expectOk(numberResult);
    expect(numberResult.value).toBe(42);
    const stringResult = await interpreter.interpret({ value: "Hello" });
    expectOk(stringResult);
    expect(stringResult.value).toBe("Hello");
    const booleanResult = await interpreter.interpret({ value: true });
    expectOk(booleanResult);
    expect(booleanResult.value).toBe(true);
    const nullResult = await interpreter.interpret({ value: null });
    expectOk(nullResult);
    expect(nullResult.value).toBeNull();
    const arrayResult = await interpreter.interpret({ value: [1, 2, 3] });
    expectOk(arrayResult);
    expect(arrayResult.value).toEqual([1, 2, 3]);
    const objectResult = await interpreter.interpret({
      value: { a: 1, b: "test" },
    });
    expectOk(objectResult);
    expect(objectResult.value).toEqual({ a: 1, b: "test" });
  });

  test("可以取得變數值", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const ctx = { variables: { x: 42, y: "Hello" } };
    const resultX = await interpreter.interpret({ get: "x" }, ctx);
    expectOk(resultX);
    expect(resultX.value).toBe(42);
    const resultY = await interpreter.interpret({ get: "y" }, ctx);
    expectOk(resultY);
    expect(resultY.value).toBe("Hello");
    const resultZ = await interpreter.interpret({ get: "z" }, ctx);
    expectOk(resultZ);
    expect(resultZ.value).toBeNull(); // 未定義的變數返回 null
  });

  test("可以使用字面值設置變數值", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const ctx: ExecutionContext = { variables: {} };
    const setResult = await interpreter.interpret({ set: "x", value: 42 }, ctx);
    expectOk(setResult);
    expect(setResult.value).toBe(42);
    expect(ctx.variables!.x).toBe(42);

    const getResult = await interpreter.interpret({ get: "x" }, ctx);
    expectOk(getResult);
    expect(getResult.value).toBe(42);
  });

  test("可以使用表達式設置變數值", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const ctx: ExecutionContext = { variables: {} };
    const setResult = await interpreter.interpret(
      {
        set: "x",
        expr: {
          op: "add",
          args: [{ value: 20 }, { value: 22 }],
        },
      },
      ctx
    );
    expectOk(setResult);
    expect(setResult.value).toBe(42);
    expect(ctx.variables!.x).toBe(42);

    const getResult = await interpreter.interpret({ get: "x" }, ctx);
    expectOk(getResult);
    expect(getResult.value).toBe(42);
  });

  test("可以處理比對運算 eq", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const eqTrueResult = await interpreter.interpret({
      op: "eq",
      args: [{ value: 1 }, { value: 1 }],
    });
    expectOk(eqTrueResult);
    expect(eqTrueResult.value).toBe(true);
    const eqFalseResult = await interpreter.interpret({
      op: "eq",
      args: [{ value: 1 }, { value: 2 }],
    });
    expectOk(eqFalseResult);
    expect(eqFalseResult.value).toBe(false);
  });

  test("可以處理比對運算 ne", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const neTrueResult = await interpreter.interpret({
      op: "ne",
      args: [{ value: 1 }, { value: 2 }],
    });
    expectOk(neTrueResult);
    expect(neTrueResult.value).toBe(true);
    const neFalseResult = await interpreter.interpret({
      op: "ne",
      args: [{ value: 1 }, { value: 1 }],
    });
    expectOk(neFalseResult);
    expect(neFalseResult.value).toBe(false);
  });

  test("可以處理比對運算 gt", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const gtResult = await interpreter.interpret({
      op: "gt",
      args: [{ value: 2 }, { value: 1 }],
    });
    expectOk(gtResult);
    expect(gtResult.value).toBe(true);
    const gtFalseResult = await interpreter.interpret({
      op: "gt",
      args: [{ value: 1 }, { value: 2 }],
    });
    expectOk(gtFalseResult);
    expect(gtFalseResult.value).toBe(false);
  });

  test("可以處理比對運算 ge", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const geResult = await interpreter.interpret({
      op: "ge",
      args: [{ value: 2 }, { value: 1 }],
    });
    expectOk(geResult);
    expect(geResult.value).toBe(true);
    const geEqualResult = await interpreter.interpret({
      op: "ge",
      args: [{ value: 1 }, { value: 1 }],
    });
    expectOk(geEqualResult);
    expect(geEqualResult.value).toBe(true);
    const geFalseResult = await interpreter.interpret({
      op: "ge",
      args: [{ value: 1 }, { value: 2 }],
    });
    expectOk(geFalseResult);
    expect(geFalseResult.value).toBe(false);
  });

  test("可以處理比對運算 lt", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const ltResult = await interpreter.interpret({
      op: "lt",
      args: [{ value: 1 }, { value: 2 }],
    });
    expectOk(ltResult);
    expect(ltResult.value).toBe(true);
    const ltFalseResult = await interpreter.interpret({
      op: "lt",
      args: [{ value: 2 }, { value: 1 }],
    });
    expectOk(ltFalseResult);
    expect(ltFalseResult.value).toBe(false);
  });

  test("可以處理比對運算 le", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const leResult = await interpreter.interpret({
      op: "le",
      args: [{ value: 1 }, { value: 2 }],
    });
    expectOk(leResult);
    expect(leResult.value).toBe(true);
    const leEqualResult = await interpreter.interpret({
      op: "le",
      args: [{ value: 1 }, { value: 1 }],
    });
    expectOk(leEqualResult);
    expect(leEqualResult.value).toBe(true);
    const leFalseResult = await interpreter.interpret({
      op: "le",
      args: [{ value: 2 }, { value: 1 }],
    });
    expectOk(leFalseResult);
    expect(leFalseResult.value).toBe(false);
  });

  test("可以處理邏輯運算 and", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const andResult = await interpreter.interpret({
      op: "and",
      args: [{ value: true }, { value: false }],
    });
    expectOk(andResult);
    expect(andResult.value).toBe(false);
    const andTrueResult = await interpreter.interpret({
      op: "and",
      args: [{ value: true }, { value: true }],
    });
    expectOk(andTrueResult);
    expect(andTrueResult.value).toBe(true);
  });

  test("可以處理邏輯運算 or", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const orResult = await interpreter.interpret({
      op: "or",
      args: [{ value: true }, { value: false }],
    });
    expectOk(orResult);
    expect(orResult.value).toBe(true);
    const orFalseResult = await interpreter.interpret({
      op: "or",
      args: [{ value: false }, { value: false }],
    });
    expectOk(orFalseResult);
    expect(orFalseResult.value).toBe(false);
  });

  test("可以處理邏輯運算 not", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const notTrueResult = await interpreter.interpret({
      op: "not",
      args: [{ value: false }],
    });
    expectOk(notTrueResult);
    expect(notTrueResult.value).toBe(true);
    const notFalseResult = await interpreter.interpret({
      op: "not",
      args: [{ value: true }],
    });
    expectOk(notFalseResult);
    expect(notFalseResult.value).toBe(false);
  });

  test("可以處理 in 運算", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const inResult = await interpreter.interpret({
      op: "in",
      args: [{ value: 1 }, { value: [1, 2, 3] }],
    });
    expectOk(inResult);
    expect(inResult.value).toBe(true);
    const inFalseResult = await interpreter.interpret({
      op: "in",
      args: [{ value: 4 }, { value: [1, 2, 3] }],
    });
    expectOk(inFalseResult);
    expect(inFalseResult.value).toBe(false);
  });

  test("可以處理數學運算 add", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const addResult = await interpreter.interpret({
      op: "add",
      args: [{ value: 1 }, { value: 2 }],
    });
    expectOk(addResult);
    expect(addResult.value).toBe(3);
  });

  test("可以處理數學運算 sub", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const subResult = await interpreter.interpret({
      op: "sub",
      args: [{ value: 5 }, { value: 2 }],
    });
    expectOk(subResult);
    expect(subResult.value).toBe(3);
  });

  test("可以處理數學運算 mul", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const mulResult = await interpreter.interpret({
      op: "mul",
      args: [{ value: 3 }, { value: 4 }],
    });
    expectOk(mulResult);
    expect(mulResult.value).toBe(12);
  });

  test("可以處理數學運算 div", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const divResult = await interpreter.interpret({
      op: "div",
      args: [{ value: 8 }, { value: 2 }],
    });
    expectOk(divResult);
    expect(divResult.value).toBe(4);
  });

  test("可以處理數學運算 mod", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const modResult = await interpreter.interpret({
      op: "mod",
      args: [{ value: 5 }, { value: 2 }],
    });
    expectOk(modResult);
    expect(modResult.value).toBe(1);
  });

  test("可以處理ctx函數調用", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const hasCall: {
      a: unknown;
      b: unknown;
    }[] = [];
    const ctx: ExecutionContext = {
      functions: {
        remoteCall: (arg1, arg2) => {
          const a = arg1 as number;
          const b = arg2 as number;
          hasCall.push({ a, b });
          return ok(a + b);
        },
      },
    };
    const callResult = await interpreter.interpret(
      {
        call: "remoteCall",
        args: [{ value: 1 }, { value: 2 }],
      },
      ctx
    );
    expect(hasCall.length).toBe(1);
    expect(hasCall[0]).toEqual({ a: 1, b: 2 });
    expectOk(callResult);
    expect(callResult.value).toBe(3);
  });

  test("可以註冊函數並調用", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const hasCall: {
      a: unknown;
      b: unknown;
    }[] = [];
    interpreter.registerFunction("remoteCall", (arg1, arg2) => {
      const a = arg1 as number;
      const b = arg2 as number;
      hasCall.push({ a, b });
      return ok(a + b);
    });

    const callResult = await interpreter.interpret({
      call: "remoteCall",
      args: [{ value: 1 }, { value: 2 }],
    });
    expect(hasCall.length).toBe(1);
    expect(hasCall[0]).toEqual({ a: 1, b: 2 });
    expectOk(callResult);
    expect(callResult.value).toBe(3);
  });

  test("可以處理區塊表達式", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const ctx: ExecutionContext = { variables: {} };
    const blockResult = await interpreter.interpret(
      {
        block: [
          { set: "x", value: 10 },
          { set: "y", value: 20 },
          { op: "add", args: [{ get: "x" }, { get: "y" }] },
        ],
      },
      ctx
    );
    expectOk(blockResult);
    expect(ctx.variables!.x).toBe(10);
    expect(ctx.variables!.y).toBe(20);
    expect(blockResult.value).toBe(30);
  });

  test("可以處理 if 表達式", async () => {
    const interpreter = new StructuredInterpreterDefault();
    const ctx: ExecutionContext = { variables: {} };
    const ifResult = await interpreter.interpret(
      {
        if: { value: true },
        then: { value: "Condition is true" },
        else: { value: "Condition is false" },
      },
      ctx
    );
    expectOk(ifResult);
    expect(ifResult.value).toBe("Condition is true");

    const ifElseResult = await interpreter.interpret(
      {
        if: { value: false },
        then: { value: "Condition is true" },
        else: { value: "Condition is false" },
      },
      ctx
    );
    expectOk(ifElseResult);
    expect(ifElseResult.value).toBe("Condition is false");
  });
});
