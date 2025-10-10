import { type Result, err, isErr, ok } from "~shared/utils/Result";
import type { MaybePromise } from "~shared/utils/TypeHelper";

import {
  type ExecutionContext,
  type Expression,
  type LiteralValue,
  type StructuredInterpreter,
  isBlockExpression,
  isCallExpression,
  isGetVariableExpression,
  isIfExpression,
  isLiteralExpression,
  isOperationExpression,
  isSetVariableByExpression,
  isSetVariableByLiteralExpression,
} from "./StructuredInterpreter";

export class StructuredInterpreterDefault implements StructuredInterpreter {
  private functions: Record<
    string,
    (...args: LiteralValue[]) => MaybePromise<Result<LiteralValue, string>>
  > = {};
  async interpret(
    expr: Expression,
    ctx: ExecutionContext = {}
  ): Promise<Result<LiteralValue, string>> {
    try {
      if (isLiteralExpression(expr)) {
        return ok(expr.value);
      }
      if (isGetVariableExpression(expr)) {
        const value = ctx?.variables?.[expr.get] ?? null;
        return ok(value);
      }
      if (isSetVariableByLiteralExpression(expr)) {
        if (!ctx.variables) {
          ctx.variables = {};
        }
        ctx.variables[expr.set] = expr.value;
        return ok(expr.value);
      }
      if (isSetVariableByExpression(expr)) {
        if (!ctx.variables) {
          ctx.variables = {};
        }
        const result = await this.interpret(expr.expr, ctx);
        if (isErr(result)) {
          return result;
        }
        ctx.variables[expr.set] = result.value;
        return ok(result.value);
      }
      if (isOperationExpression(expr)) {
        const args: LiteralValue[] = [];
        for (const arg of expr.args) {
          const result = await this.interpret(arg, ctx);
          if (isErr(result)) {
            return err(`第 ${args.length + 1} 個參數錯誤: ${result.error}`);
          }
          args.push(result.value);
        }
        const [first, ...rest] = args;
        const [left, right] = args;
        switch (expr.op) {
          case "eq":
            return ok(left === right);
          case "ne":
            return ok(left !== right);
          case "gt":
            return left === null || right === null
              ? err("比對值中有null")
              : ok(left > right);
          case "ge":
            return left === null || right === null
              ? err("比對值中有null")
              : ok(left >= right);
          case "lt":
            return left === null || right === null
              ? err("比對值中有null")
              : ok(left < right);
          case "le":
            return left === null || right === null
              ? err("比對值中有null")
              : ok(left <= right);
          case "and":
            return ok(args.every((arg) => Boolean(arg)));
          case "or":
            return ok(args.some((arg) => Boolean(arg)));
          case "not":
            return ok(!first);
          case "in":
            return Array.isArray(right)
              ? ok(right.includes(first))
              : err("右側不是陣列");
          case "add":
            return ok(args.reduce((a, b) => (a as number) + (b as number), 0));
          case "sub":
            return ok(args.reduce((a, b) => (a as number) - (b as number)));
          case "mul":
            return ok(args.reduce((a, b) => (a as number) * (b as number), 1));
          case "div":
            return rest.some((arg) => arg === 0)
              ? err("除數不能為0")
              : ok(rest.reduce((a, b) => (a as number) / (b as number), first));
          case "mod":
            return rest.some((arg) => arg === 0)
              ? err("除數不能為0")
              : ok(rest.reduce((a, b) => (a as number) % (b as number), first));
          default:
            return err("未知的操作符");
        }
      }
      if (isCallExpression(expr)) {
        const func = ctx.functions?.[expr.call] ?? this.functions[expr.call];
        if (!func) {
          return err(`函數 ${expr.call} 未註冊`);
        }
        const args: LiteralValue[] = [];
        for (const arg of expr.args) {
          const result = await this.interpret(arg, ctx);
          if (isErr(result)) {
            return err(`第 ${args.length + 1} 個參數錯誤: ${result.error}`);
          }
          args.push(result.value);
        }
        return await func(...args);
      }
      if (isBlockExpression(expr)) {
        let result: Result<LiteralValue, string> = ok(null);
        let line = 0;
        for (const subExpr of expr.block) {
          result = await this.interpret(subExpr, ctx);
          if (isErr(result)) {
            return err(`在區塊中執行 ${line} 時發生錯誤: ${result.error}`);
          }
          line++;
        }
        return result;
      }
      if (isIfExpression(expr)) {
        const conditionResult = await this.interpret(expr.if, ctx);
        if (isErr(conditionResult)) {
          return err(`條件表達式錯誤: ${conditionResult.error}`);
        }
        if (conditionResult.value) {
          return await this.interpret(expr.then, ctx);
        }
        if (expr.else) {
          return await this.interpret(expr.else, ctx);
        }
        return ok(null);
      }
      return err("未知的表達式類型");
    } catch (error) {
      return err(
        `執行時錯誤: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  registerFunction(
    name: string,
    func: (
      ...args: LiteralValue[]
    ) => MaybePromise<Result<LiteralValue, string>>
  ): void {
    this.functions[name] = func;
  }
}
