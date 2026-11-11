import {
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { IApiAdmin, UserStateFilter } from '@models/user.model';
import { AlertService } from '@services/alert.service';
import { AdminsListComponent } from './admins-list/admins-list.component';
import { AdminsToolbarComponent } from './admins-toolbar/admins-toolbar.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { ConfirmDeleteModalComponent } from '@admin/components/confirm-delete-modal/confirm-delete-modal.component';
import { AdminSelfDeleteBlockedModalComponent } from './admins-list/components/admin-self-delete-blocked-modal/admin-self-delete-blocked-modal.component';
import { AuthService } from '@services/auth.service';
import {
  injectAllAdminsQuery,
  injectSetAdminStateMutation,
} from '@services/queries/admin-queries';

@Component({
  selector: 'app-admins-page',
  imports: [
    AdminsListComponent,
    AdminsToolbarComponent,
    PaginationComponent,
    ConfirmDeleteModalComponent,
    AdminSelfDeleteBlockedModalComponent,
  ],
  templateUrl: './admins-page.component.html',
})
export class AdminsPageComponent {
  private alertService = inject(AlertService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  adminToDelete = signal<IApiAdmin | null>(null);
  showSelfDeleteBlockedModal = signal<boolean>(false);

  searchQuery = signal<string>('');
  stateFilter = signal<UserStateFilter>('Todos');

  // Al cambiar un filtro se vuelve a la página 1; la primera vez se toma la página de la URL.
  // La página forma parte de la queryKey, así que TanStack Query pide los datos solo.
  currentPage = linkedSignal<unknown, number>({
    source: () => [this.searchQuery(), this.stateFilter()],
    computation: (_filters, previous) =>
      previous ? 1 : Number(this.route.snapshot.queryParamMap.get('page')) || 1,
  });

  private activeFilters = computed(() => ({
    query: this.searchQuery(),
    state: this.stateFilter(),
    page: this.currentPage(),
    limit: 16,
  }));

  private adminsQuery = injectAllAdminsQuery(this.activeFilters);
  private setStateMutation = injectSetAdminStateMutation();

  // Solo es true cuando no hay ningún dato que mostrar: con datos anteriores en caché se siguen viendo
  loading = computed(() => this.adminsQuery.isPending());
  totalPages = computed(() => this.adminsQuery.data()?.totalPages ?? 1);

  filtersActive = computed(
    () => this.searchQuery().length > 0 || this.stateFilter() !== 'Todos',
  );

  adminsFiltered = computed(() =>
    [...(this.adminsQuery.data()?.data ?? [])].sort((a, b) => a.id - b.id),
  );

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
  }

  handleNavigateToCreate() {
    this.router.navigate(['/admin/admins/create']);
  }

  handleNavigateToEdit(admin: IApiAdmin) {
    this.router.navigate(['/admin/admins/edit', admin.id]);
  }

  handleDelete(admin: IApiAdmin) {
    // Bloquear la auto-desactivación (el servidor también la rechaza)
    if (admin.id === this.authService.currentUser()?.id) {
      this.showSelfDeleteBlockedModal.set(true);
      return;
    }

    // Que no quede el panel sin administradores activos lo controla el servidor: no se puede desactivar
    // al último administrador activo. Acá no se cuenta, porque con el filtro de estado el total de la
    // lista ya no es la cantidad de administradores activos.
    this.adminToDelete.set(admin);
  }

  // La mutación invalida la caché: la lista se vuelve a pedir y la paginación se recalcula.
  confirmDeactivateAdmin() {
    const admin = this.adminToDelete();
    if (!admin) return;

    this.setStateMutation.mutate(
      { id: admin.id, state: 'Inactivo' },
      {
        onSuccess: () => {
          this.alertService.toast('Administrador desactivado', 'success');
          this.adminToDelete.set(null);
        },
      },
    );
  }

  reactivateAdmin(admin: IApiAdmin) {
    this.setStateMutation.mutate(
      { id: admin.id, state: 'Activo' },
      {
        onSuccess: () => {
          this.alertService.toast('Administrador reactivado', 'success');
        },
      },
    );
  }
}
