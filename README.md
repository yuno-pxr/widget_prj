# widget_prj

**Lightweight desktop widget framework with EMG-lite avatar support**  
**EMG-lite 対応の軽量デスクトップウィジェットフレームワーク**

---

## Overview / 概要

widget_prj is a lightweight desktop widget framework designed for  
always-on desktop avatars, status widgets, and small visual companions.

It focuses on:
- Low resource usage (no GPU required)
- PNG-based avatar rendering
- Simple state-driven image switching
- Open and extensible design

This project is intended to be **forked and extended for learning, experimentation, and non-commercial use**.

---

widget_prj は、  
デスクトップ常駐型アバターやステータス表示、軽量なビジュアルウィジェットを目的とした  
**軽量デスクトップウィジェットフレームワーク**です。

以下を重視しています：
- GPU を必要としない低リソース設計
- PNG ベースのアバター表示
- 状態（state）によるシンプルな画像切り替え
- フォーク・改変しやすい構造

本プロジェクトは **学習・検証・非商用利用を主目的**としています。

---

## Features / 特徴

- 🧩 Standalone desktop widget framework  
- 🖼 PNG-based avatar rendering  
- 🔄 State-based image switching  
- 📄 **EMG-lite (`.emgl`) file loading support**  
- 🪶 Lightweight and suitable for low-spec environments  

---

## EMG-lite Support / EMG-lite 対応

widget_prj supports loading **EMG-lite (`.emgl`) files**, which define:
- Avatar image assets
- Logical states (e.g. `normal`, `happy`, `angry`)
- Image mappings per state

EMG-lite is treated as an open, editor-friendly avatar definition format.

This project intentionally avoids being a full animation or Live2D system  
and stays minimal and state-driven.

---

## Philosophy / 設計思想

This project separates responsibilities clearly:

- **Rendering / display** → widget_prj
- **Timeline / editing / automation** → external tools
- **Avatar definition** → EMG-lite

By keeping the widget minimal, it remains easy to understand, fork, and adapt.

---

## Forking & Contributions / フォーク・貢献について

Forking is allowed and encouraged **for non-commercial purposes**, including:

- Learning and research
- Prototyping
- Personal tools
- Experimental or internal projects

Pull requests are welcome, but not required.

---

## License / ライセンス

### Source Code / ソースコード

The **source code** of this project is licensed under the  
**Apache License, Version 2.0**.

However, **commercial use of the source code (including modified versions) is NOT permitted without prior permission**.

This restriction exists because:
- Code quality and behavior cannot be guaranteed in third-party deployments
- The author cannot provide commercial-level support or warranty

If you wish to use the source code for commercial purposes,  
please contact us in advance via the inquiry form.

---

本プロジェクトの **ソースコード**は  
**Apache License 2.0** のもとで公開されています。

ただし、**改変の有無を問わず、商用利用は禁止**されています（要事前許諾）。

これは、
- コード品質や動作保証を行えないこと
- 商用サポート責任を負えないこと
を理由としています。

商用利用を希望される場合は、  
必ず事前に問い合わせフォームよりご連絡ください。

---

### Release Binaries / リリースバイナリについて

Official release binaries provided by this project are **NOT permitted for commercial use**.

These binaries are provided for:
- Evaluation
- Testing
- Personal use only

Commercial redistribution or use of release binaries requires explicit permission.

---

本プロジェクトが配布する **公式リリースバイナリ**は、  
**商用利用不可**です。

評価・検証・個人利用のみを目的としています。  
商用利用・再配布を希望する場合は、事前にご相談ください。

---

### Assets / アセットについて（重要）

Assets included in this repository (images, characters, icons, sample avatars, etc.)  
are **NOT covered by the Apache License 2.0**.

Assets are provided for demonstration and development purposes only.  
Commercial use requires prior permission.

See **ASSETS_LICENSE.md** for details.

---

## Commercial Use / 商用利用について

For any commercial use involving:
- Source code
- Release binaries
- Assets

please contact us **in advance** via the inquiry form.

Commercial use without explicit permission is prohibited.

---

## Related Project / 関連プロジェクト

- EMG / EMG-lite  
  https://github.com/pxrllc/emg

---

## Status / 開発状況

This project is under active development.  
APIs and internal structures may change without notice.

---

## Disclaimer / 免責事項

This software is provided **“as is”**, without warranty of any kind.
