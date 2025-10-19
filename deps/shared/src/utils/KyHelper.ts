import { HTTPError, type NormalizedOptions } from "ky";

export function buildParms(query: {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined
    | (string | number | boolean)[];
}) {
  const params = new URLSearchParams();
  Object.keys(query).map((key) => {
    const value = query[key];
    if (value === "" || value === null || value === undefined) return;
    if (typeof value === "object") {
      value.forEach((element) => {
        params.append(key, element.toString());
      });
    } else {
      params.append(key, value.toString());
    }
  });
  return params;
}

export class BadRequestHTTPError extends HTTPError {
  constructor(
    response: Response,
    request: Request,
    options: NormalizedOptions,
    public errorCode: string
  ) {
    super(response, request, options);
  }
}

export async function tryGetErrorCode(error: unknown) {
  if (error instanceof HTTPError) {
    const errorCode = await error.response.json();
    if (typeof errorCode === "string") return errorCode;
  }
  return undefined;
}
