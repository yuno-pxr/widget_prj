# Monolith Widget

[English](#english) | [日本語](#japanese)

---

<a name="english"></a>
## English

### Overview
**Monolith Widget** is an experimental desktop widget application designed with a focus on aesthetics and "design-first" principles. It serves as a playground for exploring modern UI/UX concepts in a desktop environment.

**Disclaimer**: This project is strictly experimental and intended for design purposes only. The release binaries are provided "as is" without any warranty of any kind, express or implied. Use at your own risk.

### Versioning Rules
The project follows a specific versioning schema: `Major.Minor.Dev-Suffix`

*   **Major** (0): Major milestone or rewrite.
*   **Minor** (1): Feature additions.
*   **Dev** (4): Development iteration count.
*   **Suffix**:
    *   `-b`: **Beta Binary** (Release candidate or public test build).
    *   `-s`: **Source / Dev Binary** (Development snapshot).

Example: `0.1.4-b` indicates Version 0.1, 4th iteration, Beta build.

### Environment Setup

#### Prerequisites
*   Node.js (v18 or later recommended)
*   npm (included with Node.js)

#### Installation
1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd widget_prj
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

#### Development
To start the development server with hot-reload:
```bash
npm run dev:electron
```

#### Build
To create a portable binary:
```bash
npm run pack
```
Output will be in `dist_packager/`.

---

<a name="japanese"></a>
## 日本語

### 概要
**Monolith Widget** は、美学と「デザインファースト」の原則に焦点を当てて設計された実験的なデスクトップウィジェットアプリケーションです。デスクトップ環境におけるモダンなUI/UXコンセプトを探求するためのプレイグラウンドとして機能します。

**免責事項**: 本プロジェクトは完全に実験的なものであり、設計・デザインの検討を主目的としています。リリースされるバイナリに対しては、明示または黙示を問わず、いかなる保証も行いません。ご自身の責任においてご利用ください。

### バージョン表記ルール
本プロジェクトでは以下のバージョン表記規則を採用しています： `メジャー.マイナー.開発-サフィックス`

*   **メジャー** (0): メジャーマイルストーンまたは書き換え。
*   **マイナー** (1): 機能追加。
*   **開発** (4): 開発イテレーション回数。
*   **サフィックス**:
    *   `-b`: **ベータ版バイナリ** (リリース候補または公開テストビルド)。
    *   `-s`: **ソース / 開発版バイナリ** (開発スナップショット)。

例: `0.1.4-b` は、バージョン 0.1、第4イテレーションのベータビルドを示します。

### 環境構築

#### 前提条件
*   Node.js (v18以降推奨)
*   npm (Node.jsに含まれています)

#### インストール
1.  リポジトリをクローンします:
    ```bash
    git clone <repository-url>
    cd widget_prj
    ```
2.  依存関係をインストールします:
    ```bash
    npm install
    ```

#### 開発
ホットリロード対応の開発サーバーを起動するには:
```bash
npm run dev:electron
```

#### ビルド
ポータブルバイナリを作成するには:
```bash
npm run pack
```
出力は `dist_packager/` ディレクトリに生成されます。


### リリース

#### 配布物について

AIでコーディングしているため、弊社及び開発者はいかなる保証も行いません。


#### 配布バイナリ

[0.1.9.2]https://drive.google.com/file/d/1RFil2xPHXfvki0INvaB-NoSujrcnSuiV/view?usp=sharing

