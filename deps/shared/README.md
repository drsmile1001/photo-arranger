# 🧰 Bun Shared Modules

本專案為 **Bun 專案共用模組庫**，透過 `git subtree` 的方式整合至多個專案中

## 🌱 使用方式（Subtree）

### 1. 在目標 repo 中拉入本 repo

```bash
git subtree add --prefix=shared https://github.com/drsmile1001/bun-shared.git main --squash
```

### 2. 更新共用模組（pull）

```bash
git subtree pull --prefix=shared https://github.com/drsmile1001/bun-shared.git main --squash
```

## 🧪 測試

本 repo 預設以 [`bun`](https://bun.sh/) 作為 runtime，建議使用：

```bash
bun test
```

## 📝 License

MIT
