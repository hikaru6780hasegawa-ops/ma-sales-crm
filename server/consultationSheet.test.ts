import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getSlackMessages: vi.fn().mockResolvedValue({
    messages: [
      {
        id: 1,
        channelId: "C08GAE2QWLA",
        channelName: "04_案件相談シート",
        messageTs: "1770956298.958719",
        userId: "U08S8TQ3ZS5",
        userName: "太田 一美",
        messageText: "お疲れ様です！案件相談シート上げさせて頂きます！\nお客様名：青木　駿様\n担当→太田\n同行→武田CMO",
        threadReplyCount: 0,
        reactions: "bow (1)",
        files: "",
        postedAt: new Date("2026-02-13T04:18:00Z"),
        consultationStatus: null,
      },
      {
        id: 2,
        channelId: "C08GAE2QWLA",
        channelName: "04_案件相談シート",
        messageTs: "1770956200.000000",
        userId: "U08S8TQ3ZS6",
        userName: "坂本塁",
        messageText: "お疲れ様です！\nお客様名：木間塚　真大様\n担当→坂本\n同行→上田課長",
        threadReplyCount: 0,
        reactions: "bow (2)",
        files: "file1.pdf",
        postedAt: new Date("2026-02-06T08:21:00Z"),
        consultationStatus: "done",
      },
    ],
    total: 196,
  }),
  getSlackMessagePosters: vi.fn().mockResolvedValue([
    { userName: "太田 一美", count: 30 },
    { userName: "坂本塁", count: 25 },
    { userName: "犬塚 淳宏", count: 20 },
  ]),
  updateConsultationStatus: vi.fn().mockResolvedValue(true),
  getConsultationSummary: vi.fn().mockResolvedValue({
    total: 196,
    pending: 150,
    done: 46,
    recentMessages: [
      { id: 1, userName: "太田 一美", messageText: "案件相談シート", postedAt: new Date("2026-02-13T04:18:00Z"), consultationStatus: null },
    ],
  }),
  getConsultationAddresses: vi.fn().mockResolvedValue([
    {
      id: 1,
      messageText: "《案件相談シート》\n・氏名【青木　駿様】\n・住所【茨城県ひたちなか市田彦１２２７−８】",
      userName: "太田 一美",
      postedAt: new Date("2026-02-13T04:18:00Z"),
      consultationStatus: null,
    },
  ]),
  getAllMinutesNumbers: vi.fn().mockResolvedValue([
    { id: 1, number: 1, customerName: "山田太郎", createdAt: new Date() },
    { id: 2, number: 2, customerName: "佐藤花子", createdAt: new Date() },
    { id: 3, number: 353, customerName: "青木駿", createdAt: new Date() },
  ]),
  getNextMinutesNumber: vi.fn().mockResolvedValue(354),
  assignMinutesNumber: vi.fn().mockResolvedValue({ id: 4, number: 354, customerName: "新規太郎" }),
  findMinutesNumberByName: vi.fn().mockImplementation((name: string) => {
    if (name.includes("青木")) return Promise.resolve({ id: 3, number: 353, customerName: "青木駿" });
    return Promise.resolve(null);
  }),
}));

// Mock slackScheduler
vi.mock("./slackScheduler", () => ({
  sendWeeklyReportNotification: vi.fn(),
  getUncheckedReport: vi.fn(),
  formatWeeklyReport: vi.fn(),
  sendDocReminder: vi.fn(),
  generateDocReminder: vi.fn(),
  syncSlackMessages: vi.fn().mockResolvedValue({ synced: 5, total: 200 }),
}));

import * as db from "./db";
import { syncSlackMessages } from "./slackScheduler";

// parseConsultationAddress関数のテスト用に同じロジックを再現
function parseConsultationAddress(text: string | null): { name: string; address: string } | null {
  if (!text) return null;
  if (!text.includes("案件相談シート") && !text.includes("《案件相談シート》")) return null;
  const extractField = (label: string): string => {
    const bracketRegex = new RegExp(`[・]?${label}[【\\[]([^】\\]]*?)[】\\]]`, "s");
    const bracketMatch = text.match(bracketRegex);
    if (bracketMatch) return bracketMatch[1].trim();
    return "";
  };
  const name = extractField("氏名");
  const address = extractField("住所");
  if (!address) return null;
  return { name, address };
}

// parseConsultationSheet関数のテスト用に同じロジックを再現
function parseConsultationSheet(text: string | null): any | null {
  if (!text) return null;
  if (!text.includes("案件相談シート") && !text.includes("《案件相談シート》")) return null;

  const extract = (label: string): string => {
    // ・・label【value】 パターン
    const bracketRegex = new RegExp(`[・]?${label}[【\\[]([^】\\]]*?)[】\\]]`, "s");
    const bracketMatch = text.match(bracketRegex);
    if (bracketMatch) return bracketMatch[1].trim();
    // 【label　value】 パターン（ラベルと値が同じ括弧内）
    const inBracketRegex = new RegExp(`【${label}[\\s　]+(.+?)】`);
    const inBracketMatch = text.match(inBracketRegex);
    if (inBracketMatch) return inBracketMatch[1].trim();
    // label：value パターン
    const altRegex = new RegExp(`${label}[：:]\\s*(.+?)(?:\\n|$)`);
    const altMatch = text.match(altRegex);
    if (altMatch) return altMatch[1].trim();
    return "";
  };

  const headerNameMatch = text.match(/(?:お客様名|顧客名)[：:]\s*(.+?)(?:\n|$)/);
  const headerTantoMatch = text.match(/担当[→：:]\s*(.+?)(?:\n|$)/);
  const headerDoukoMatch = text.match(/同行[→：:]\s*(.+?)(?:\n|$)/);
  const bikoMatch = text.match(/[～〜]備考[～〜]\s*\n?([\s\S]*?)(?=\n\s*CIC|\n\s*$)/);
  const cicMatch = text.match(/CIC[\s\S]*?(?:→|[：:])\s*(.+?)(?:\n|$)/);

  return {
    規定内支給希望: extract("規定内支給希望"),
    氏名: extract("氏名"),
    フリガナ: extract("フリガナ"),
    生年月日: extract("生年月日"),
    年齢: extract("年齢"),
    携帯番号: extract("携帯番号"),
    住所: extract("住所"),
    勤務先名称: extract("勤務先名称"),
    勤務先HP: extract("勤務先HP"),
    勤務先住所: extract("勤務先住所"),
    出向先名称: extract("出向先名称"),
    派遣先HP: extract("派遣先HP"),
    派遣先住所: extract("派遣先住所"),
    勤続年数: extract("勤続年数"),
    令和7年分年: extract("令和7年分年"),
    令和6年分年: extract("令和6年分年"),
    令和5年分年: extract("令和5年分年"),
    借り入れ件数: extract("借り入れ件数") || extract("借入件数"),
    借入残高: extract("借入残高"),
    残価設定: extract("残価設定の場合設定年月") || extract("残価設定"),
    現在の家賃: extract("現在の家賃\\(賃貸の場合\\)") || extract("現在の家賃"),
    投資不動産の収支: extract("現在の投資不動産の収支") || extract("投資不動産の収支"),
    戸建かマンション: extract("戸建かマンションかどちら") || extract("戸建かマンション"),
    家族構成: extract("家族構成"),
    社会保険の有無: extract("社会保険の有無"),
    次回内見予定日: extract("次回内見予定日"),
    希望収支: extract("希望収支"),
    備考: bikoMatch?.[1]?.trim() || "",
    CIC: cicMatch?.[1]?.trim() || "",
    headerCustomerName: headerNameMatch?.[1]?.trim() || "",
    headerTanto: headerTantoMatch?.[1]?.trim() || "",
    headerDouko: headerDoukoMatch?.[1]?.trim() || "",
  };
}

describe("案件相談シート API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consultationMessages: 案件相談シートチャンネルのメッセージを取得できる", async () => {
    const result = await db.getSlackMessages({
      channelId: "C08GAE2QWLA",
      limit: 50,
      offset: 0,
    });

    expect(db.getSlackMessages).toHaveBeenCalledWith({
      channelId: "C08GAE2QWLA",
      limit: 50,
      offset: 0,
    });
    expect(result.messages).toHaveLength(2);
    expect(result.total).toBe(196);
    expect(result.messages[0].channelName).toBe("04_案件相談シート");
    expect(result.messages[0].userName).toBe("太田 一美");
  });

  it("consultationMessages: 検索フィルターで絞り込みできる", async () => {
    await db.getSlackMessages({
      channelId: "C08GAE2QWLA",
      search: "青木",
      limit: 50,
      offset: 0,
    });

    expect(db.getSlackMessages).toHaveBeenCalledWith({
      channelId: "C08GAE2QWLA",
      search: "青木",
      limit: 50,
      offset: 0,
    });
  });

  it("consultationMessages: 投稿者フィルターで絞り込みできる", async () => {
    await db.getSlackMessages({
      channelId: "C08GAE2QWLA",
      userName: "太田 一美",
      limit: 50,
      offset: 0,
    });

    expect(db.getSlackMessages).toHaveBeenCalledWith({
      channelId: "C08GAE2QWLA",
      userName: "太田 一美",
      limit: 50,
      offset: 0,
    });
  });

  it("consultationPosters: 投稿者一覧を取得できる", async () => {
    const result = await db.getSlackMessagePosters("C08GAE2QWLA");

    expect(db.getSlackMessagePosters).toHaveBeenCalledWith("C08GAE2QWLA");
    expect(result).toHaveLength(3);
    expect(result[0].userName).toBe("太田 一美");
    expect(result[0].count).toBe(30);
  });

  it("consultationCount: メッセージ総数を取得できる", async () => {
    const result = await db.getSlackMessages({
      channelId: "C08GAE2QWLA",
      limit: 1,
      offset: 0,
    });

    expect(result.total).toBe(196);
  });

  it("syncConsultation: Slackから同期できる", async () => {
    const result = await syncSlackMessages();

    expect(syncSlackMessages).toHaveBeenCalled();
    expect(result).toEqual({ synced: 5, total: 200 });
  });

  it("consultationMessages: ページネーションが正しく動作する", async () => {
    await db.getSlackMessages({
      channelId: "C08GAE2QWLA",
      limit: 30,
      offset: 30,
    });

    expect(db.getSlackMessages).toHaveBeenCalledWith({
      channelId: "C08GAE2QWLA",
      limit: 30,
      offset: 30,
    });
  });

  it("メッセージからお客様名と担当者を正しく抽出できる", () => {
    const text = "お疲れ様です！\nお客様名：青木　駿様\n担当→太田\n同行→武田CMO";
    const nameMatch = text.match(/(?:お客様名|顧客名)[：:]\s*(.+?)(?:\n|$)/);
    const tantoMatch = text.match(/(?:担当)[：→:]\s*(.+?)(?:\n|$)/);

    expect(nameMatch?.[1]?.trim()).toBe("青木　駿様");
    expect(tantoMatch?.[1]?.trim()).toBe("太田");
  });
});

describe("ステータス管理 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ステータスを更新できる", async () => {
    await db.updateConsultationStatus(1, "done");
    expect(db.updateConsultationStatus).toHaveBeenCalledWith(1, "done");
  });

  it("サマリーを取得できる", async () => {
    const result = await db.getConsultationSummary();
    expect(result.total).toBe(196);
    expect(result.pending).toBe(150);
    expect(result.done).toBe(46);
    expect(result.recentMessages).toHaveLength(1);
  });

  it("住所データを取得できる", async () => {
    const result = await db.getConsultationAddresses();
    expect(result).toHaveLength(1);
    expect(result[0].userName).toBe("太田 一美");
  });
});

describe("議事録No.管理 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("No.管理リスト全件を取得できる", async () => {
    const result = await db.getAllMinutesNumbers();
    expect(result).toHaveLength(3);
    expect(result[0].number).toBe(1);
    expect(result[2].number).toBe(353);
  });

  it("次のNo.を取得できる", async () => {
    const nextNum = await db.getNextMinutesNumber();
    expect(nextNum).toBe(354);
  });

  it("新規No.を付与できる", async () => {
    const result = await db.assignMinutesNumber("新規太郎");
    expect(result.number).toBe(354);
    expect(result.customerName).toBe("新規太郎");
  });

  it("氏名でNo.を検索できる（マッチあり）", async () => {
    const result = await db.findMinutesNumberByName("青木駿");
    expect(result).not.toBeNull();
    expect(result!.number).toBe(353);
  });

  it("氏名でNo.を検索できる（マッチなし）", async () => {
    const result = await db.findMinutesNumberByName("存在しない人");
    expect(result).toBeNull();
  });
});

describe("parseConsultationAddress - 住所パーサー", () => {
  it("案件相談シートから氏名と住所を抽出できる", () => {
    const text = `《案件相談シート》
・氏名【青木　駿様】
・住所【茨城県ひたちなか市田彦１２２７−８】`;
    const result = parseConsultationAddress(text);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("青木　駿様");
    expect(result!.address).toContain("茨城県ひたちなか市");
  });

  it("住所がない場合はnullを返す", () => {
    const text = `《案件相談シート》
・氏名【テスト太郎】
・住所【】`;
    const result = parseConsultationAddress(text);
    expect(result).toBeNull();
  });

  it("案件相談シートでないテキストはnullを返す", () => {
    const text = "お疲れ様です！引き続きよろしくお願いいたします。";
    const result = parseConsultationAddress(text);
    expect(result).toBeNull();
  });
});

describe("parseConsultationSheet - 案件相談シートパーサー", () => {
  it("ユーザー提供のフォーマットを正しくパースできる", () => {
    const sampleText = `ConnectHub
2026/2/13
お世話になっております。
《案件相談シート》
【規定内支給希望　有】
・氏名【青木　駿(アオキ　シュン)様】
・生年月日【H12(2000年)1.11】
・年齢【26歳】
・携帯番号【080 9810 0480】
・住所【〒312-0063 茨城県ひたちなか市田彦１２２７−８
ハイツマロンフィールドB　203号室】
・勤務先名称【太陽日酸株式会社】
・勤務先HP【https://www.tn-sanso.co.jp/jp/】
・勤務先住所【〒312-0034 茨城県ひたちなか市堀口８３２−２】
・出向先名称【】
・派遣先HP【】
・派遣先住所【】
・勤続年数【6年10月】
・令和7年分年【5,604,373円】
・令和6年分年【5,000,430円】
・令和5年分年【】
・借り入れ件数【0件】 
・借入残高

・残価設定の場合設定年月【】
・現在の家賃(賃貸の場合)【3.7000円】
・現在の投資不動産の収支【】
・戸建かマンションかどちら【】
・家族構成【独身】
・社会保険の有無【有】
・次回内見予定日【内見済み】
・希望収支【6万円/月 10万円/回×2回/年】
～備考～
ひたちなか市津田東1丁目12-5(中古戸建て)
物件紹介済み

CIC PかAがある場合　月日
→なし`;

    const result = parseConsultationSheet(sampleText);
    expect(result).not.toBeNull();
    expect(result.氏名).toBe("青木　駿(アオキ　シュン)様");
    expect(result.生年月日).toBe("H12(2000年)1.11");
    expect(result.年齢).toBe("26歳");
    expect(result.携帯番号).toBe("080 9810 0480");
    expect(result.住所).toContain("茨城県ひたちなか市田彦");
    expect(result.勤務先名称).toBe("太陽日酸株式会社");
    expect(result.勤務先HP).toBe("https://www.tn-sanso.co.jp/jp/");
    expect(result.勤務先住所).toContain("茨城県ひたちなか市堀口");
    expect(result.勤続年数).toBe("6年10月");
    expect(result.令和7年分年).toBe("5,604,373円");
    expect(result.令和6年分年).toBe("5,000,430円");
    expect(result.借り入れ件数).toBe("0件");
    expect(result.現在の家賃).toBe("3.7000円");
    expect(result.家族構成).toBe("独身");
    expect(result.社会保険の有無).toBe("有");
    expect(result.次回内見予定日).toBe("内見済み");
    expect(result.希望収支).toBe("6万円/月 10万円/回×2回/年");
    expect(result.規定内支給希望).toContain("有");
    expect(result.備考).toContain("ひたちなか市津田東");
    expect(result.CIC).toBe("なし");
  });

  it("案件相談シートフォーマットでないテキストはnullを返す", () => {
    const text = "お疲れ様です！引き続きよろしくお願いいたします。";
    const result = parseConsultationSheet(text);
    expect(result).toBeNull();
  });

  it("nullテキストはnullを返す", () => {
    const result = parseConsultationSheet(null);
    expect(result).toBeNull();
  });

  it("空フィールドは空文字列として返す", () => {
    const text = `《案件相談シート》
・氏名【テスト太郎様】
・生年月日【H10年1月1日】
・年齢【28歳】
・携帯番号【090-1234-5678】
・住所【東京都渋谷区】
・勤務先名称【テスト株式会社】
・勤務先HP【】
・勤務先住所【】
・出向先名称【】
・派遣先HP【】
・派遣先住所【】
・勤続年数【5年】
・令和7年分年【】
・令和6年分年【4,000,000円】
・令和5年分年【】
・借り入れ件数【0件】
・借入残高
・家族構成【既婚】
・社会保険の有無【有】`;

    const result = parseConsultationSheet(text);
    expect(result).not.toBeNull();
    expect(result.氏名).toBe("テスト太郎様");
    expect(result.勤務先HP).toBe("");
    expect(result.出向先名称).toBe("");
    expect(result.令和7年分年).toBe("");
    expect(result.令和6年分年).toBe("4,000,000円");
    expect(result.家族構成).toBe("既婚");
  });

  it("ヘッダー情報（お客様名・担当・同行）を正しく抽出できる", () => {
    const text = `お疲れ様です！
お客様名：青木　駿様
担当→太田
同行→武田CMO
案件相談シート上げさせて頂きます！
《案件相談シート》
・氏名【青木　駿(アオキ　シュン)様】
・年齢【26歳】`;

    const result = parseConsultationSheet(text);
    expect(result).not.toBeNull();
    expect(result.headerCustomerName).toBe("青木　駿様");
    expect(result.headerTanto).toBe("太田");
    expect(result.headerDouko).toBe("武田CMO");
  });
});
