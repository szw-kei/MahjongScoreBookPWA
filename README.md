# MahjongScoreBook PWA v1

個人利用向けの麻雀成績記録PWAです。HTML/CSS/JavaScriptのみで動作し、データはlocalStorageに自動保存します。

## ローカル確認
`python3 -m http.server 8000` を実行し、`http://localhost:8000` を開いてください。

## iPhone
HTTPSで公開したURLをSafariで開き、「ホーム画面に追加」するとPWAとして利用できます。


## v6
- 通常モードの未入力セルを「—」ではなく空欄で表示。
- Service Workerのキャッシュバージョンを更新。
