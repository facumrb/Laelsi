import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  effect,
  untracked,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { IApiAdmin, UserStateFilter } from '@models/user.model';
import { ApiAdminService } from '@services/api-services/api-admin.service';
import { AlertService } from '@services/alert.service';
import { AdminsListComponent } from './admins-list/admins-list.component';
import { AdminsToolbarComponent } from './admins-toolbar/admins-toolbar.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { ConfirmDeleteModalComponent } from '@admin/components/confirm-delete-modal/confirm-delete-modal.component';
import { AdminSelfDeleteBlockedModalComponent } from './admins-list/components/admin-self-delete-blocked-modal/admin-self-delete-blocked-modal.component';
import { AuthService } from '@services/auth.service';

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
export class AdminsPageComponent implements OnInit {
  private alertService = inject(AlertService);
  private apiService = inject(ApiAdminService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private adminsRaw = signal<IApiAdmin[]>([]);
  currentPage = signal<number>(1);
  totalPages = signal<number>(1);
  adminToDelete = signal<IApiAdmin | null>(null);
  showSelfDeleteBlockedModal = signal<boolean>(false);

  searchQuery = signal<string>('');
  stateFilter = signal<UserStateFilter>('Todos');

  filtersActive = computed(
    () => this.searchQuery().length > 0 || this.stateFilter() !== 'Todos',
  );

  adminsFiltered = computed(() => {
    // El filtrado fuerte (búsqueda y estado) se hace en el server.
    return [...this.adminsRaw()].sort((a, b) => a.id - b.id);
  });

  constructor() {
    // Reacciona SOLO cuando el usuario cambia la búsqueda o el filtro de estado.
    // Resetea a página 1 y recarga, sin crear loops.
    effect(() => {
      this.searchQuery(); // trackea cambios de búsqueda
      this.stateFilter(); // trackea cambios del filtro de estado
      untracked(() => {
        // Evitamos actuar en la primera ejecución (ngOnInit se encarga)
        if (this.initialLoadDone) {
          this.currentPage.set(1);
          this.loadAdmins();
        }
      });
    });
  }

  private initialLoadDone = false;

  ngOnInit() {
    // Leer la página de la URL al entrar
    const pageParam = this.route.snapshot.queryParamMap.get('page');
    this.currentPage.set(Number(pageParam) || 1);
    this.loadAdmins();
    this.initialLoadDone = true;
  }

  loadAdmins() {
    const query = this.searchQuery().trim();
    const state = this.stateFilter();

    if (query) {
      this.apiService.searchAdmins(query, this.currentPage(), 16, state).subscribe({
        next: (data) => {
          this.adminsRaw.set(data.data);
          this.totalPages.set(data.totalPages);
        },
      });
    } else {
      this.apiService.getAllAdmins(this.currentPage(), 16, state).subscribe({
        next: (data) => {
          this.adminsRaw.set(data.data);
          this.totalPages.set(data.totalPages);
        },
      });
    }
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
    this.loadAdmins();
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

  // ID 65 de docs/requerimientos/discusiones.md: no se elimina a ningún administrador, solo se lo desactiva.
  confirmDeactivateAdmin() {
    const admin = this.adminToDelete();
    if (!admin) return;

    this.apiService.setAdminState(admin.id, 'Inactivo').subscribe({
      next: () => {
        this.alertService.toast('Administrador desactivado', 'success');
        this.adminToDelete.set(null);
        // Recargamos desde el servidor para que la paginación y el filtro de estado se recalculen
        this.loadAdmins();
      },
    });
  }

  reactivateAdmin(admin: IApiAdmin) {
    this.apiService.setAdminState(admin.id, 'Activo').subscribe({
      next: () => {
        this.alertService.toast('Administrador reactivado', 'success');
        this.loadAdmins();
      },
    });
  }
}
