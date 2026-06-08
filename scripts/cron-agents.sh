#!/bin/bash
# StudioSage Cron Agents — 服务器端独立运行，不依赖 Claude Code 会话
# 部署: crontab -e 添加对应行

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPORT_DIR="$SCRIPT_DIR/../reports"
mkdir -p "$REPORT_DIR"/{content,competitor,daily,monitor,support,growth}

TODAY=$(date +%Y-%m-%d)
NOW=$(date +%H:%M)

case "$1" in
  content)
    echo "[$NOW] 内容运营 agent triggered" >> "$REPORT_DIR/content/trigger.log"
    ;;
  competitor)
    echo "[$NOW] 竞品情报 agent triggered" >> "$REPORT_DIR/competitor/trigger.log"
    ;;
  daily)
    cd "$SCRIPT_DIR/.." && git log --since="24 hours ago" --oneline > "$REPORT_DIR/daily/$TODAY.md" 2>/dev/null
    echo "## Cron Status" >> "$REPORT_DIR/daily/$TODAY.md"
    echo "- Generated: $TODAY $NOW" >> "$REPORT_DIR/daily/$TODAY.md"
    ;;
  monitor)
    echo "$TODAY $NOW node=$(node -v) git=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 https://github.com) npm=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 https://registry.npmjs.org)" >> "$REPORT_DIR/monitor/log.md"
    ;;
  growth)
    echo "[$NOW] 市场推广 agent triggered" >> "$REPORT_DIR/growth/trigger.log"
    ;;
  *)
    echo "Usage: $0 {content|competitor|daily|monitor|growth}"
    ;;
esac
