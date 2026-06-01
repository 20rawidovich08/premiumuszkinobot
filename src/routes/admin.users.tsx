import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listBotUsers } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/users")({ component: UsersPage });

function UsersPage() {
  const fn = useServerFn(listBotUsers);
  const { data } = useQuery({ queryKey: ["bot_users"], queryFn: () => fn() });
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Bot foydalanuvchilari</h1>
      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr><th className="px-4 py-3">Telegram ID</th><th>Ism</th><th>Username</th><th>Kinolar</th><th>Qo‘shilgan</th><th>So‘nggi faollik</th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((u: any) => (
              <tr key={u.id} className="border-t border-border/40">
                <td className="px-4 py-3 font-mono">{u.telegram_id}</td>
                <td>{u.first_name} {u.last_name ?? ""}</td>
                <td className="text-muted-foreground">{u.username ? "@" + u.username : "—"}</td>
                <td>{u.movies_watched}</td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="text-muted-foreground">{new Date(u.last_activity_at).toLocaleString()}</td>
              </tr>
            ))}
            {!data?.length && <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Hali foydalanuvchi yo‘q.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
