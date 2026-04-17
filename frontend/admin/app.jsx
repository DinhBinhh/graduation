const { useEffect, useState } = React;

const emptyForm = {
  id: null,
  name: "",
  note: "",
  coverImage: null,
  scare: false,
  cardImage: null,
  videoFile: null,
  keepCover: true,
  keepVideo: true
};

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

function App() {
  const [token, setToken] = useState(localStorage.getItem("adminToken") || "");
  const [adminUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("adminUser") || "null");
    } catch (error) {
      return null;
    }
  });
  const [items, setItems] = useState([]);
  const [wishes, setWishes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [activeTab, setActiveTab] = useState("cards");
  const [selectedInvitationId, setSelectedInvitationId] = useState("all");
  const [wishKeyword, setWishKeyword] = useState("");
  const [feedback, setFeedback] = useState("Sẵn sàng.");
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Yêu cầu thất bại");
    }
    return payload.data;
  }

  function handleAuthFailure(error) {
    const message = error.message.toLowerCase();
    if (message.includes("token") || message.includes("unauthorized") || message.includes("invalid")) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminUser");
      setToken("");
    }
  }

  async function loadItems() {
    if (!token) return;

    try {
      const data = await api("/api/admin/cards");
      setItems(data);
      setFeedback("Đã tải danh sách thiệp.");
    } catch (error) {
      setFeedback(error.message);
      handleAuthFailure(error);
    }
  }

  async function loadWishes() {
    if (!token) return;

    try {
      const data = await api("/api/admin/wishes");
      setWishes(data);
    } catch (error) {
      setFeedback(error.message);
      handleAuthFailure(error);
    }
  }

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    Promise.all([loadItems(), loadWishes()]).finally(() => setLoading(false));
  }, [token]);

  function resetForm() {
    setForm(emptyForm);
  }

  function startEdit(item) {
    setForm({
      id: item.id,
      name: item.name,
      note: item.note || "",
      coverImage: null,
      scare: item.scare,
      cardImage: null,
      videoFile: null,
      keepCover: Boolean(item.coverImage),
      keepVideo: Boolean(item.videoUrl)
    });
    setActiveTab("cards");
    setFeedback(`Đang sửa thiệp của ${item.name}.`);
  }

  function buildFormData() {
    const data = new FormData();
    data.append("name", form.name);
    data.append("note", form.note);
    data.append("scare", String(form.scare));
    data.append("keepCover", String(form.keepCover));
    data.append("keepVideo", String(form.keepVideo));

    if (form.coverImage) data.append("coverImage", form.coverImage);
    if (form.cardImage) data.append("cardImage", form.cardImage);
    if (form.videoFile) data.append("videoFile", form.videoFile);

    return data;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setFeedback("Vui lòng nhập tên người nhận.");
      return;
    }

    if (!form.id && !form.cardImage) {
      setFeedback("Thiệp mới cần ảnh thiệp.");
      return;
    }

    setLoading(true);
    setFeedback(form.id ? "Đang cập nhật thiệp..." : "Đang tạo thiệp...");

    try {
      const method = form.id ? "PUT" : "POST";
      const path = form.id ? `/api/admin/cards/${form.id}` : "/api/admin/cards";

      await api(path, {
        method,
        body: buildFormData()
      });

      resetForm();
      await Promise.all([loadItems(), loadWishes()]);
      setFeedback(form.id ? "Đã cập nhật thiệp." : "Đã tạo thiệp mới.");
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm("Bạn chắc chắn muốn xóa thiệp này?");
    if (!confirmed) return;

    setLoading(true);
    setFeedback("Đang xóa thiệp...");

    try {
      await api(`/api/admin/cards/${id}`, { method: "DELETE" });
      if (form.id === id) resetForm();
      await Promise.all([loadItems(), loadWishes()]);
      setFeedback("Đã xóa thiệp.");
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteWish(id) {
    const confirmed = window.confirm("Bạn có muốn xóa lời chúc này không?");
    if (!confirmed) return;

    setLoading(true);
    setFeedback("Đang xóa lời chúc...");

    try {
      await api(`/api/admin/wishes/${id}`, { method: "DELETE" });
      await loadWishes();
      setFeedback("Đã xóa lời chúc.");
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(item) {
    const absoluteUrl = item.publicSlug
      ? `${window.location.origin}/?invite=${encodeURIComponent(item.publicSlug)}`
      : `${window.location.origin}${item.publicUrl || `/card.html?name=${encodeURIComponent(item.name)}`}`;

    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setFeedback(`Đã copy link thiệp của ${item.name}.`);
    } catch (error) {
      setFeedback(`Không copy được. Link: ${absoluteUrl}`);
    }
  }

  async function copyLookupLink() {
    const owner = adminUser?.username;
    const absoluteUrl = owner
      ? `${window.location.origin}/?owner=${encodeURIComponent(owner)}`
      : `${window.location.origin}/`;

    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setFeedback("Đã copy link trang nhập tên của tài khoản này.");
    } catch (error) {
      setFeedback(`Không copy được. Link: ${absoluteUrl}`);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setFeedback("Vui lòng nhập đầy đủ thông tin đổi mật khẩu.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setFeedback("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    setPasswordLoading(true);
    setFeedback("Đang đổi mật khẩu...");

    try {
      await api("/api/admin/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });

      setPasswordForm(emptyPasswordForm);
      setFeedback("Đổi mật khẩu thành công.");
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setPasswordLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    setToken("");
    window.location.href = "/";
  }

  function getDownloadName(url, fallbackName) {
    if (!url) return fallbackName;

    try {
      const pathname = new URL(url, window.location.origin).pathname;
      const lastSegment = pathname.split("/").filter(Boolean).pop();
      return lastSegment || fallbackName;
    } catch (error) {
      return fallbackName;
    }
  }

  function getMediaProxyUrl(url, { download = false, fallbackName = "media-file" } = {}) {
    if (!url) return "#";

    const params = new URLSearchParams({
      src: url
    });

    if (download) {
      params.set("download", "1");
      params.set("name", getDownloadName(url, fallbackName));
    }

    return `/api/media?${params.toString()}`;
  }

  const normalizedWishKeyword = wishKeyword.trim().toLowerCase();
  const filteredWishes = wishes.filter((wish) => {
    const matchesInvitation =
      selectedInvitationId === "all" || String(wish.invitationId) === String(selectedInvitationId);

    if (!matchesInvitation) {
      return false;
    }

    if (!normalizedWishKeyword) {
      return true;
    }

    const haystack = [wish.invitationName, wish.senderName, wish.message]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedWishKeyword);
  });

  if (!token) {
    return (
      <main className="admin-app">
        <section className="panel form-panel">
          <p className="feedback">
            Chưa có phiên đăng nhập. Hãy quay lại trang chủ và đăng nhập bằng tài khoản admin.
          </p>
          <button className="primary-button" onClick={() => (window.location.href = "/")}>
            Về trang chủ
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-app">
      <section className="hero">
        <div>
          <p>Trang quản trị</p>
          <p>{adminUser?.username ? `Tài khoản: ${adminUser.username}` : "Mỗi tài khoản chỉ thấy thiệp của mình."}</p>
          <h1>Quản lý thiệp tốt nghiệp</h1>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={copyLookupLink}>
            Copy link nhập tên
          </button>
          <button className="logout-button" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </section>

      <section className="panel tab-panel">
        <div className="tab-strip" role="tablist" aria-label="Điều hướng admin">
          <button
            className={`tab-button ${activeTab === "cards" ? "tab-button--active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "cards"}
            onClick={() => setActiveTab("cards")}
          >
            Thiệp
          </button>
          <button
            className={`tab-button ${activeTab === "wishes" ? "tab-button--active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "wishes"}
            onClick={() => setActiveTab("wishes")}
          >
            Lời chúc
          </button>
          <button
            className={`tab-button ${activeTab === "security" ? "tab-button--active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "security"}
            onClick={() => setActiveTab("security")}
          >
            Bảo mật
          </button>
        </div>
        <p className="feedback">{feedback}</p>
      </section>

      {activeTab === "cards" && (
        <>
          <section className="panel form-panel">
            <form className="form-grid" onSubmit={handleSubmit}>
              <div className="field">
                <label>Tên người nhận</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn A"
                />
              </div>

              <div className="field">
                <label>Ghi chú hiển thị trong thiệp</label>
                <textarea
                  rows="5"
                  value={form.note}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                  placeholder="Nhập lời nhắn sẽ hiện bên trong thiệp"
                />
              </div>

              <div className="field">
                <label>Ảnh bìa (tùy chọn)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setForm({ ...form, coverImage: event.target.files[0] || null })}
                />
              </div>

              <div className="field">
                <label>Ảnh thiệp</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setForm({ ...form, cardImage: event.target.files[0] || null })}
                />
              </div>

              <div className="field">
                <label>Video scare</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(event) => setForm({ ...form, videoFile: event.target.files[0] || null })}
                />
              </div>

              <div className="field">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.keepCover}
                    onChange={(event) => setForm({ ...form, keepCover: event.target.checked })}
                  />
                  Giữ ảnh bìa hiện tại
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.scare}
                    onChange={(event) => setForm({ ...form, scare: event.target.checked })}
                  />
                  Bật scare mode
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.keepVideo}
                    onChange={(event) => setForm({ ...form, keepVideo: event.target.checked })}
                  />
                  Giữ video hiện tại
                </label>
              </div>

              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={loading}>
                  {form.id ? "Cập nhật" : "Thêm mới"}
                </button>
                <button className="secondary-button" type="button" onClick={resetForm}>
                  Làm mới form
                </button>
              </div>
            </form>
          </section>

          <section className="panel table-shell">
            {items.length ? (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Người nhận</th>
                    <th>Ảnh thiệp</th>
                    <th>Ảnh bìa</th>
                    <th>Scare</th>
                    <th>Video</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.name}</td>
                      <td>
                        <img className="thumb" src={item.cardImage} alt={item.name} />
                      </td>
                      <td>{item.coverImage ? "Có" : "Tự tạo"}</td>
                      <td>{item.scare ? "Bật" : "Tắt"}</td>
                      <td>{item.videoUrl ? "Có" : "Không"}</td>
                      <td>
                        <div className="table-actions">
                          <button className="secondary-button" type="button" onClick={() => copyLink(item)}>
                            Copy link thiệp
                          </button>
                          <button className="secondary-button" type="button" onClick={() => startEdit(item)}>
                            Sửa
                          </button>
                          <button className="danger-button" type="button" onClick={() => handleDelete(item.id)}>
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p>{loading ? "Đang tải..." : "Chưa có thiệp nào trong hệ thống."}</p>
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === "wishes" && (
        <>
          <section className="panel form-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Lời chúc đã nhận</p>
                <h2>Quản lý lời chúc</h2>
              </div>
              <p>Lọc nhanh theo thiệp hoặc tìm theo tên người gửi.</p>
            </div>
            <div className="filter-grid">
              <div className="field">
                <label>Lọc theo thiệp</label>
                <select value={selectedInvitationId} onChange={(event) => setSelectedInvitationId(event.target.value)}>
                  <option value="all">Tất cả thiệp</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Tìm kiếm lời chúc</label>
                <input
                  type="text"
                  value={wishKeyword}
                  onChange={(event) => setWishKeyword(event.target.value)}
                  placeholder="Nhập tên người gửi hoặc nội dung"
                />
              </div>
            </div>
          </section>

          <section className="panel table-shell">
            {filteredWishes.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Thiệp</th>
                    <th>Người gửi</th>
                    <th>Lời nhắn</th>
                    <th>Ảnh</th>
                    <th>Video</th>
                    <th>Thời gian</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWishes.map((wish) => (
                    <tr key={wish.id}>
                      <td>{wish.invitationName || `#${wish.invitationId}`}</td>
                      <td>{wish.senderName || "Ẩn danh"}</td>
                      <td>{wish.message || "Không có lời nhắn"}</td>
                      <td>
                        {wish.imageUrl ? (
                          <div className="table-actions">
                            <a
                              className="secondary-button"
                              href={getMediaProxyUrl(wish.imageUrl)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Xem ảnh
                            </a>
                            <a
                              className="secondary-button"
                              href={getMediaProxyUrl(wish.imageUrl, {
                                download: true,
                                fallbackName: `wish-image-${wish.id}.jpg`
                              })}
                              download={getDownloadName(wish.imageUrl, `wish-image-${wish.id}.jpg`)}
                            >
                              Tải ảnh
                            </a>
                          </div>
                        ) : (
                          "Không"
                        )}
                      </td>
                      <td>
                        {wish.videoUrl ? (
                          <div className="table-actions">
                            <a
                              className="secondary-button"
                              href={getMediaProxyUrl(wish.videoUrl)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Xem video
                            </a>
                            <a
                              className="secondary-button"
                              href={getMediaProxyUrl(wish.videoUrl, {
                                download: true,
                                fallbackName: `wish-video-${wish.id}.mp4`
                              })}
                              download={getDownloadName(wish.videoUrl, `wish-video-${wish.id}.mp4`)}
                            >
                              Tải video
                            </a>
                          </div>
                        ) : (
                          "Không"
                        )}
                      </td>
                      <td>{new Date(wish.createdAt).toLocaleString("vi-VN")}</td>
                      <td>
                        <button className="danger-button" type="button" onClick={() => handleDeleteWish(wish.id)}>
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p>Chưa có lời chúc phù hợp với bộ lọc hiện tại.</p>
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === "security" && (
        <section className="panel form-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Bảo mật admin</p>
              <h2>Đổi mật khẩu</h2>
            </div>
            <p>Mật khẩu mới nên có ít nhất 8 ký tự.</p>
          </div>
          <form className="form-grid" onSubmit={handleChangePassword}>
            <div className="field">
              <label>Mật khẩu hiện tại</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                placeholder="Nhập mật khẩu hiện tại"
              />
            </div>

            <div className="field">
              <label>Mật khẩu mới</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                placeholder="Ít nhất 8 ký tự"
              />
            </div>

            <div className="field">
              <label>Xác nhận mật khẩu mới</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                placeholder="Nhập lại mật khẩu mới"
              />
            </div>

            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={passwordLoading}>
                {passwordLoading ? "Đang lưu..." : "Đổi mật khẩu"}
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
