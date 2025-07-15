#!/bin/bash

# デフォルトのトピック名を定義

DEFAULT_TOPIC_NAME="your-topic-name-D615CCC1-8C83-450C-9DF9-8044F234A296"

# 設定（環境変数が設定されていればそれを使用、なければデフォルトを使用）

TOPIC_NAME="${NTFY_TOPIC:-$DEFAULT_TOPIC_NAME}"

# transcript_pathを取得

TRANSCRIPT=$(jq -r .transcript_path)

# 最新のアシスタントメッセージを取得

LATEST_MSG=$(tail -1 "$TRANSCRIPT" | jq -r '.message.content[0].text // empty')

# 最新のユーザーメッセージを取得

USER_MSG=""

while IFS= read -r line; do
  TYPE=$(echo "$line" | jq -r '.type // empty')
  if [ "$TYPE" = "user" ]; then
    ROLE=$(echo "$line" | jq -r '.message.role // empty')
    if [ "$ROLE" = "user" ]; then
      CONTENT=$(echo "$line" | jq -r '.message.content // empty')
      # contentが文字列で、[で始まらない場合のみ採用
      if [ -n "$CONTENT" ] && [ "${CONTENT:0:1}" != "[" ]; then
        USER_MSG="$CONTENT"
        break
      fi
    fi
  fi

done < <(tac "$TRANSCRIPT")

# メッセージが空でない場合のみ送信

if [ -n "$LATEST_MSG" ]; then
  echo "$LATEST_MSG" | sed 's/^/ /' | head -c 500 | \
  curl -H "Title: ${USER_MSG:0:100}" -d @- "ntfy.sh/${TOPIC_NAME}"
fi
