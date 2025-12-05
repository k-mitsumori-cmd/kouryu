import OpenAI from 'openai';

// タスクタイプに応じた参考資料を生成
export default async function handler(req, res) {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { taskName, category, eventTitle, eventDate, eventDetails } = req.body;

        // バリデーション
        if (!taskName || !eventTitle || !eventDetails) {
            return res.status(400).json({ 
                error: 'タスク名、イベント名、イベント詳細は必須です' 
            });
        }

        // OpenAI APIキーの確認
        if (!process.env.OPENAI_API_KEY) {
            // APIキーがない場合はテンプレートベースで返す
            const template = getTemplateForTask(taskName, category, eventTitle, eventDate);
            return res.json(template);
        }

        // OpenAIクライアントの初期化
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // タスクタイプに応じたプロンプトを作成
        const prompt = createPromptForTask(taskName, category, eventTitle, eventDate, eventDetails);

        // OpenAI APIを呼び出し
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'あなたはB2Bマーケティングとイベント企画・運営の専門家です。B2Bマーケティングのセオリーとベストプラクティスに基づいて、提供されたタスクに関する実践的な参考資料、テンプレート、注意点を詳しく説明してください。B2Bマーケティングでは、意思決定者へのアプローチ、ビジネス価値の明確な訴求、ROIの提示、専門性と信頼性が重要です。'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        const generatedText = completion.choices[0].message.content;

        // 生成されたテキストを構造化
        const result = parseGeneratedContent(generatedText, taskName, category);

        res.json(result);

    } catch (error) {
        console.error('参考資料生成エラー:', error);
        // エラー時はテンプレートを返す
        const template = getTemplateForTask(
            req.body.taskName, 
            req.body.category, 
            req.body.eventTitle, 
            req.body.eventDate
        );
        res.json(template);
    }
}

// タスクタイプに応じたプロンプトを作成
function createPromptForTask(taskName, category, eventTitle, eventDate, eventDetails) {
    const basePrompt = `あなたはB2Bマーケティングの専門家です。
以下のタスクに関するB2Bマーケティングのセオリーに基づいた参考資料を作成してください。

【タスク名】
${taskName}

【カテゴリ】
${category}

【イベント情報】
- イベント名: ${eventTitle}
- 開催日: ${eventDate}
- 詳細: ${eventDetails}

【重要】B2Bマーケティングの特徴を考慮してください：
- 意思決定者へのアプローチが重要
- ビジネス価値（ROI、効率化、コスト削減など）を明確に訴求
- 専門性と信頼性を重視
- 段階的なコミュニケーション（フォローアップが重要）
- 長期的な関係構築を意識
- データや事例を活用
- ビジネス用語を適切に使用

【作成してほしい内容】
1. 参考テンプレート・例文（B2Bマーケティングのベストプラクティスに基づいた実用的な形式で）
2. チェックリスト（B2Bマーケティングで重要な項目）
3. 注意点・ポイント（B2Bマーケティング特有の注意事項）
4. 追加で検討すべき項目（B2Bマーケティングで効果的な追加施策）

【出力形式】
以下の形式で出力してください：

## 参考テンプレート

（B2Bマーケティングのベストプラクティスに基づいた実際に使用できるテンプレートを記載）

## チェックリスト

（B2Bマーケティングで重要なチェック項目を箇条書きで）

## 注意点

（B2Bマーケティング特有の重要なポイントを箇条書きで）

## 追加項目

（B2Bマーケティングで効果的な追加で検討すべき項目を箇条書きで）`;

    // タスクタイプに応じて詳細な指示を追加
    if (taskName.includes('メール') || taskName.includes('招待状')) {
        return basePrompt + `

【B2Bメールマーケティングの重要ポイント】
- 件名はビジネス価値を明確に（「ROI向上」「業務効率化」「成功事例」など）
- 冒頭で意思決定者にとってのメリットを明示
- イベント参加による具体的なビジネス成果を記載
- 参加者の役職・業種を意識した内容
- データや統計、成功事例を活用
- CTA（行動喚起）を明確に
- 期限や締切日を明確に記載
- 会社名・役職などの必須情報を記載`;
    }

    if (taskName.includes('リマインド')) {
        return basePrompt + `

【B2Bリマインドメールの重要ポイント】
- イベント前日または数日前に送信（B2Bは意思決定に時間がかかるため余裕をもって）
- ビジネス価値の再確認（参加するメリットを再度強調）
- 会場情報、時間、アクセス方法を詳細に
- 参加者の役職・業種に応じた内容
- ネットワーキングの価値も強調
- 直前キャンセルの連絡方法も記載`;
    }

    if (taskName.includes('受付') || taskName.includes('台本')) {
        return basePrompt + `

【特に注意してほしい点】
- 受付の流れを明確に（来場から着席まで）
- 担当者の役割分担を明確に
- よくある質問への対応方法
- トラブル時の対応フロー
- 来場者への案内文も含める`;
    }

    if (taskName.includes('アンケート')) {
        return basePrompt + `

【B2Bアンケートの重要ポイント】
- イベント直後（記憶が新鮮なうち）に送信
- 質問項目は簡潔に（ビジネスパーソンは時間が限られているため5-10問程度）
- ビジネス成果の測定（ROI、業務改善への影響など）
- 満足度、改善点、次回参加意向を確認
- 業種・役職別の回答も確認
- 選択肢と自由記述を組み合わせ（効率的に回答できるように）
- 謝辞とフォローアップの案内も含める`;
    }

    return basePrompt;
}

// 生成されたコンテンツを構造化
function parseGeneratedContent(text, taskName, category) {
    const sections = {
        template: '',
        checklist: [],
        notes: [],
        additionalItems: []
    };

    // セクションごとに抽出
    const templateMatch = text.match(/## 参考テンプレート\s*\n([\s\S]*?)(?=## |$)/);
    if (templateMatch) {
        sections.template = templateMatch[1].trim();
    }

    const checklistMatch = text.match(/## チェックリスト\s*\n([\s\S]*?)(?=## |$)/);
    if (checklistMatch) {
        sections.checklist = checklistMatch[1]
            .split('\n')
            .filter(line => line.trim() && (line.includes('-') || line.includes('・') || line.includes('✓')))
            .map(line => line.replace(/^[-・✓\s]+/, '').trim())
            .filter(item => item.length > 0);
    }

    const notesMatch = text.match(/## 注意点\s*\n([\s\S]*?)(?=## |$)/);
    if (notesMatch) {
        sections.notes = notesMatch[1]
            .split('\n')
            .filter(line => line.trim() && (line.includes('-') || line.includes('・')))
            .map(line => line.replace(/^[-・\s]+/, '').trim())
            .filter(item => item.length > 0);
    }

    const additionalMatch = text.match(/## 追加項目\s*\n([\s\S]*?)(?=## |$)/);
    if (additionalMatch) {
        sections.additionalItems = additionalMatch[1]
            .split('\n')
            .filter(line => line.trim() && (line.includes('-') || line.includes('・')))
            .map(line => line.replace(/^[-・\s]+/, '').trim())
            .filter(item => item.length > 0);
    }

    // パースがうまくいかない場合は全文をテンプレートとして使用
    if (!sections.template && !sections.checklist.length) {
        sections.template = text;
    }

    return sections;
}

// テンプレートベースの参考資料（フォールバック用）
function getTemplateForTask(taskName, category, eventTitle, eventDate) {
    const templates = {
        'メール文案作成': {
            template: `件名: 【ご案内】${eventTitle} - ビジネス成果を高める実践的ノウハウを共有

[会社名] 様
[役職名] 様

いつもお世話になっております。
[会社名]の[名前]です。

この度、${eventTitle}を開催いたします。
本イベントでは、[具体的なビジネス価値・成果]について、実践的なノウハウと成功事例を共有いたします。

【イベント概要】
- 日時: ${eventDate} [時刻]
- 場所: [会場名]
- 定員: [人数]名（先着順）
- 参加費: [金額]（税込）

【参加いただくメリット】
・[具体的なビジネス成果1: 例「ROI向上のための実践手法」]
・[具体的なビジネス成果2: 例「業務効率化の成功事例」]
・[具体的なビジネス成果3: 例「同業他社とのネットワーキング機会」]

【プログラム概要】
[プログラムの詳細を記載]

【お申し込み方法】
[申し込み方法・URLを記載]
※ お申し込み期限: [日付]まで

【お問い合わせ】
[問い合わせ先・メールアドレス・電話番号]

ご多忙中恐れ入りますが、ぜひご参加いただけますと幸いです。
皆様にお会いできることを楽しみにしております。

[送信者名]
[会社名]
[役職]
[連絡先]`,
            checklist: [
                '件名にビジネス価値を明記しているか',
                '宛先の役職・会社名が正しいか',
                '具体的なビジネス成果を記載しているか',
                'イベントの日時・場所が正確か',
                '参加方法が分かりやすいか',
                '締切日を明記しているか',
                '問い合わせ先が明記されているか'
            ],
            notes: [
                'B2Bは意思決定に時間がかかるため、イベントの2-3週間前までに送信',
                '冒頭でビジネス価値を明確に訴求',
                'ROI、効率化、コスト削減などの具体的な成果を記載',
                'データや成功事例を活用すると効果的',
                '返信期限を明確に設定',
                '会社名・役職などの必須情報を記載'
            ],
            additionalItems: [
                '業種・役職別のカスタマイズ案',
                'リマインドメールの送信スケジュール',
                '参加確定メールの送信',
                'キャンセル待ちリストの管理',
                'フォローアップメールの計画'
            ]
        },
        '招待状送付（メール）': {
            template: `件名: 【特別ご招待】${eventTitle} - ビジネスパートナー様限定

[会社名]
[部署名]
[役職名] [氏名] 様

いつも大変お世話になっております。
[会社名]の[名前]です。

この度、ビジネスパートナー様限定で${eventTitle}を開催いたします。
本イベントでは、[具体的なビジネス価値]について、[著名な講師名/企業名]による特別セッションを予定しております。

【イベント詳細】
- 日時: ${eventDate} [時刻]～[終了時刻]
- 場所: [会場名]
- 住所: [住所]
- 参加費: [金額]（通常価格[金額]より[割引率]%OFF）
- 定員: [人数]名様

【本イベントで得られる価値】
・[ビジネス成果1: 例「売上向上のための実践的アプローチ」]
・[ビジネス成果2: 例「同業他社の成功事例の共有」]
・[ビジネス成果3: 例「最新トレンドとその活用方法」]

【プログラム】
[詳細なプログラムを記載]

【お申し込み】
[申し込みURLまたはフォーム]
※ お申し込み期限: [日付]まで

ご多忙中恐れ入りますが、ぜひご参加いただけますようお願い申し上げます。

[送信者名]
[会社名]
[役職]
[連絡先]`,
            checklist: [
                '宛先の会社名・部署名・役職名が正確か',
                'ビジネス価値を明確に記載しているか',
                '日時・場所が正確か',
                '参加方法が明確か',
                '返信期限を明記しているか'
            ],
            notes: [
                'B2Bでは個人名・役職名を正確に記載',
                '会社名・部署名まで記載することで信頼性が向上',
                'ビジネス価値（ROI、成果）を冒頭で明示',
                '返信期限は開催日の1-2週間前を推奨',
                '特別感を演出（限定、特別価格など）'
            ],
            additionalItems: [
                '業種別のカスタマイズ案',
                '招待状のデザイン',
                'メール以外の送付方法の検討',
                'フォローアップのタイミング'
            ]
        },
        'リマインド通知配信（参加確定者向け）': {
            template: `件名: 【リマインド】${eventTitle} 明日開催です！

${eventTitle} リマインド

[参加者名] 様

${eventTitle}にご参加いただき、ありがとうございます。

明日、${eventDate}にイベントを開催いたします。
以下の情報をご確認ください。

【開催情報】
- 日時: ${eventDate} [開始時間]
- 場所: [会場名]
- 住所: [住所]
- アクセス: [アクセス方法]

【当日の持ち物】
- [持ち物1]
- [持ち物2]

【ご注意事項】
- 会場への到着は開始時刻の15分前を推奨
- キャンセルの場合は[連絡先]までご連絡ください

皆様にお会いできることを楽しみにしております。

[主催者名]`,
            checklist: [
                '会場情報が正確か',
                'アクセス方法が分かりやすいか',
                '開始時刻を明記しているか',
                '連絡先が記載されているか'
            ],
            notes: [
                'イベント前日または2日前に送信',
                '会場情報は詳細に記載',
                'アクセス方法は複数の手段を記載',
                'キャンセル連絡先も明記'
            ],
            additionalItems: [
                '当日の天気情報',
                '駐車場情報',
                '最寄り駅からの案内図'
            ]
        },
        '受付フロー設計＆台本作成': {
            template: `【受付フロー】

1. 来場者の到着
   → スタッフ: 「いらっしゃいませ。${eventTitle}へのご参加ありがとうございます。」
   
2. 名札の確認・配布
   → スタッフ: 「お名前を教えていただけますか？」
   → 名簿で確認後、名札を渡す
   
3. 参加費の確認（有料の場合）
   → スタッフ: 「参加費はお支払い済みでしょうか？」
   
4. 会場への案内
   → スタッフ: 「会場はこちらになります。名札をお付けください。」
   → 会場入口を指し示す

【よくある質問への対応】

Q: 名札が見つかりません
A: 「お名前を確認いたしますので、少しお待ちください。」→ 名簿で確認

Q: 参加費はどこで支払いますか？
A: 「受付でお支払いいただけます。現金またはクレジットカードがご利用いただけます。」

Q: 会場はどこですか？
A: 「[会場名]の[フロア名]になります。こちらから[方向]にお進みください。」`,
            checklist: [
                '受付担当者の役割分担が明確か',
                '名札・名簿の準備',
                '参加費の支払い方法の確認',
                '会場への案内方法の決定',
                'よくある質問への対応方法'
            ],
            notes: [
                '受付は開始時刻の30分前から開始',
                '複数の受付カウンターを準備（来場者が多い場合）',
                '名札は事前に準備しておく',
                '混雑時の対応も想定する'
            ],
            additionalItems: [
                '受付担当者のシフト表',
                '名札のデザイン',
                '受付カウンターのレイアウト',
                'キャンセル待ちの対応'
            ]
        },
        '参加者アンケート配信': {
            template: `件名: ${eventTitle} アンケートのお願い

アンケートのお願い

[参加者名] 様

${eventTitle}にご参加いただき、ありがとうございました。

より良いイベント運営のため、アンケートにご協力いただけますと幸いです。
所要時間は約3分です。

【アンケートURL】
[URLを記載]

【アンケート内容】
1. 今回のイベントの満足度
2. 良かった点
3. 改善してほしい点
4. 次回も参加したいか
5. その他ご意見・ご要望

ご協力のほど、よろしくお願いいたします。

[主催者名]`,
            checklist: [
                'アンケートの質問項目が明確か',
                '所要時間が明記されているか',
                '回答期限を設定しているか',
                '謝辞が含まれているか'
            ],
            notes: [
                'イベント終了後、なるべく早く送信（24時間以内推奨）',
                '質問は5-10問程度に絞る',
                '選択肢と自由記述を組み合わせる',
                '回答期限は1週間後を推奨'
            ],
            additionalItems: [
                '謝礼や特典の検討',
                'アンケート結果の集計方法',
                '改善点の反映計画'
            ]
        }
    };

    // タスク名に一致するテンプレートを検索
    for (const [key, value] of Object.entries(templates)) {
        if (taskName.includes(key) || key.includes(taskName)) {
            return value;
        }
    }

    // デフォルトテンプレート
    return {
        template: `${taskName}に関する参考資料

【概要】
${taskName}について、以下の点を確認・準備してください。

【チェックリスト】
- [ ] 必要な資料・情報の準備
- [ ] 担当者の決定
- [ ] スケジュールの確認
- [ ] 関係者への連絡`,
        checklist: [
            '必要な資料・情報の準備',
            '担当者の決定',
            'スケジュールの確認'
        ],
        notes: [
            '事前に十分な準備時間を確保する',
            '関係者とコミュニケーションを密に取る'
        ],
        additionalItems: [
            '追加で検討すべき項目があれば記載'
        ]
    };
}

